import type { NextRequest } from "next/server"

import { aracAnalizVerisi } from "../../veri"
import { csvOlustur, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("rapor", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }

  const satirlar = await aracAnalizVerisi(filtreler)

  const icerik = csvOlustur(
    ["Marka", "Kart Sayısı", "Genel Toplam", "Ort. Kart Tutarı"],
    satirlar.map((s) => [s.marka, s.kartSayisi, csvTutar(s.genelToplam), csvTutar(s.ortalamaKartTutari)])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "kabuller",
    aciklama: `Servis Araç Analiz raporu dışa aktarıldı (${satirlar.length} marka)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `servis-arac-analiz-${bugun}.csv`)
}
