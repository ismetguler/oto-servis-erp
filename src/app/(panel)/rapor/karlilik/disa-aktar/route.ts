import type { NextRequest } from "next/server"

import { karlilikVerisi } from "../../veri"
import { csvOlustur, csvTarih, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("rapor", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }

  const satirlar = await karlilikVerisi(filtreler)

  const icerik = csvOlustur(
    [
      "Kabul No",
      "Teslim Tarihi",
      "Plaka",
      "Müşteri",
      "Parça Satış",
      "Parça Maliyet",
      "Parça Kâr",
      "İşçilik Geliri",
      "Dış Hizmet",
      "Toplam Kâr",
      "Kâr Oranı (%)",
    ],
    satirlar.map((s) => [
      s.kabulNo,
      csvTarih(s.teslimTarihi),
      s.plaka,
      s.musteri,
      csvTutar(s.parcaSatis),
      csvTutar(s.parcaMaliyet),
      csvTutar(s.parcaKar),
      csvTutar(s.iscilikGeliri),
      csvTutar(s.disHizmetToplam),
      csvTutar(s.toplamKar),
      csvTutar(s.karOrani),
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "kabuller",
    aciklama: `Onarım Kârlılık raporu dışa aktarıldı (${satirlar.length} kart)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `onarim-karlilik-${bugun}.csv`)
}
