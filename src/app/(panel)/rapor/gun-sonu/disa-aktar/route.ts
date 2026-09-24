import type { NextRequest } from "next/server"

import { gunSonuVerisi } from "../../veri"
import { csvOlustur, csvTarih, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("rapor", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }

  const satirlar = await gunSonuVerisi(filtreler)

  const icerik = csvOlustur(
    ["Tarih", "Açılan Kart", "Teslim Edilen", "Parça + Dış Hizmet", "İşçilik", "Genel Toplam", "Tahsilat"],
    satirlar.map((s) => [
      csvTarih(s.gun),
      s.acilanKabul,
      s.teslimEdilenKabul,
      csvTutar(s.parcaToplam),
      csvTutar(s.iscilikToplam),
      csvTutar(s.genelToplam),
      csvTutar(s.tahsilat),
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "kabuller",
    aciklama: `Servis Gün Sonu raporu dışa aktarıldı (${satirlar.length} gün)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `servis-gun-sonu-${bugun}.csv`)
}
