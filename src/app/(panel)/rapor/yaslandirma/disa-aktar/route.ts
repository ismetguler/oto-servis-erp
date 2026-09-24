import type { NextRequest } from "next/server"

import { cariYaslandirmaVerisi } from "../../veri"
import { CARI_TUR_ADLARI } from "../../../cari/sema"
import { csvOlustur, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("cari", "gor")

  const asOf = istek.nextUrl.searchParams.get("asOf") ?? ""

  const satirlar = await cariYaslandirmaVerisi(asOf)

  const icerik = csvOlustur(
    [
      "Kod",
      "Ünvan",
      "Tür",
      "Vadesi Gelmemiş",
      "1-30 Gün",
      "31-60 Gün",
      "61-90 Gün",
      "90+ Gün",
      "Toplam Bakiye",
    ],
    satirlar.map((s) => [
      s.kod,
      s.unvan,
      CARI_TUR_ADLARI[s.turu as keyof typeof CARI_TUR_ADLARI] ?? s.turu,
      csvTutar(s.vadesiGelmemis),
      csvTutar(s.g0_30),
      csvTutar(s.g31_60),
      csvTutar(s.g61_90),
      csvTutar(s.g90ustu),
      csvTutar(s.toplamBakiye),
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "cari_hareketleri",
    aciklama: `Cari Yaşlandırma raporu dışa aktarıldı (${satirlar.length} kayıt)`,
    yeniDeger: { asOf },
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `cari-yaslandirma-${bugun}.csv`)
}
