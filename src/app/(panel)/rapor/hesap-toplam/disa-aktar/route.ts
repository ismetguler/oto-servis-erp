import type { NextRequest } from "next/server"

import { hesapToplamVerisi } from "../../veri"
import { CARI_TUR_ADLARI } from "../../../cari/sema"
import { csvOlustur, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("cari", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }

  const satirlar = await hesapToplamVerisi(filtreler)

  const icerik = csvOlustur(
    [
      "Kod",
      "Ünvan",
      "Tür",
      "Fatura",
      "Servis",
      "Tahsilat",
      "Ödeme",
      "Dönem Borç",
      "Dönem Alacak",
    ],
    satirlar.map((s) => [
      s.kod,
      s.unvan,
      CARI_TUR_ADLARI[s.turu as keyof typeof CARI_TUR_ADLARI] ?? s.turu,
      csvTutar(s.evrakNet),
      csvTutar(s.kabulNet),
      csvTutar(s.tahsilatNet),
      csvTutar(s.tediyeNet),
      csvTutar(s.borcToplam),
      csvTutar(s.alacakToplam),
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "cari_hareketleri",
    aciklama: `Cari Hesap Toplamları raporu dışa aktarıldı (${satirlar.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `cari-hesap-toplam-${bugun}.csv`)
}
