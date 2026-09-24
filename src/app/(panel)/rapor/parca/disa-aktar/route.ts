import type { NextRequest } from "next/server"

import { yapilanParcalarVerisi } from "../../veri"
import { csvOlustur, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("rapor", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }

  const satirlar = await yapilanParcalarVerisi(filtreler)

  const icerik = csvOlustur(
    ["Parça", "İşlem Sayısı", "Miktar", "Tutar"],
    satirlar.map((s) => [s.ad, s.islemSayisi, csvTutar(s.miktar), csvTutar(s.tutar)])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "kabul_kalemleri",
    aciklama: `Yapılan Parçalar raporu dışa aktarıldı (${satirlar.length} kalem)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `yapilan-parcalar-${bugun}.csv`)
}
