import type { NextRequest } from "next/server"

import { yillikAnalizVerisi } from "../../veri"
import { csvOlustur, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("rapor", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }

  const satirlar = await yillikAnalizVerisi(filtreler)

  const icerik = csvOlustur(
    ["Ay", "Kart Sayısı", "Parça + Dış Hizmet", "İşçilik Toplam", "Genel Toplam", "Ort. Kart Tutarı"],
    satirlar.map((s) => [
      s.ayEtiketi,
      s.kartSayisi,
      csvTutar(s.parcaToplam),
      csvTutar(s.iscilikToplam),
      csvTutar(s.genelToplam),
      csvTutar(s.ortalamaKartTutari),
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "kabuller",
    aciklama: `Servis Yıllık Analiz raporu dışa aktarıldı (${satirlar.length} ay)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `servis-yillik-analiz-${bugun}.csv`)
}
