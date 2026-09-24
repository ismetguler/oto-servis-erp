import type { NextRequest } from "next/server"

import { icmalVerisi } from "../../veri"
import { csvOlustur, csvTarih, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("rapor", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }

  const satirlar = await icmalVerisi(filtreler)

  const icerik = csvOlustur(
    [
      "Tarih",
      "Açılan Kart",
      "Teslim Edilen",
      "Kesilen Fatura",
      "Fatura Tutarı",
      "Tahsilat",
      "Tediye",
      "Net",
    ],
    satirlar.map((s) => [
      csvTarih(s.gun),
      s.acilanKabul,
      s.teslimEdilenKabul,
      s.kesilenFatura,
      csvTutar(s.faturaToplam),
      csvTutar(s.tahsilat),
      csvTutar(s.tediye),
      csvTutar(s.tahsilat - s.tediye),
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "kabuller",
    aciklama: `Günlük İcmal raporu dışa aktarıldı (${satirlar.length} gün)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `gunluk-icmal-${bugun}.csv`)
}
