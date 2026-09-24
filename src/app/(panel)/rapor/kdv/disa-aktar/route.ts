import type { NextRequest } from "next/server"

import { kdvOzetiVerisi } from "../../veri"
import { csvOlustur, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("cari", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }

  const satirlar = await kdvOzetiVerisi(filtreler)

  const icerik = csvOlustur(
    // Bu dosya muhasebeciye gidiyor: ekrandaki sade dilin aksine tutar
    // sütunları burada duruyor (beyan matrahı lazım olur).
    [
      "Ay",
      "Satış Fatura Adedi",
      "Satış Tutarı (KDV hariç)",
      "Satış KDV",
      "Alış Fatura Adedi",
      "Alış Tutarı (KDV hariç)",
      "Alış KDV",
      "Ödenecek KDV",
    ],
    satirlar.map((s) => [
      s.ayEtiketi,
      String(s.satisFaturaSayisi),
      csvTutar(s.satisMatrah),
      csvTutar(s.satisKdv),
      String(s.alisFaturaSayisi),
      csvTutar(s.alisMatrah),
      csvTutar(s.alisKdv),
      csvTutar(s.fark),
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "evraklar",
    aciklama: `KDV Özeti raporu dışa aktarıldı (${satirlar.length} ay)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `kdv-ozeti-${bugun}.csv`)
}
