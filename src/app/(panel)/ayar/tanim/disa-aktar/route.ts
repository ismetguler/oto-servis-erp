import type { NextRequest } from "next/server"

import { tanimlariGetir } from "../veri"
import { csvOlustur, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"
import type { TanimTur } from "@/generated/prisma/enums"
import { GENEL_TANIM_TURLERI, TUR_ADLARI } from "@/lib/tanim-turleri"

/**
 * BİR TANIM TÜRÜNÜ EXCEL'E AKTAR — ekrandaki `?tur=` neyse o iner.
 * Geçersiz/gizli tür istenirse ilk genel türe düşülür (ekranla aynı davranış).
 */
export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("ayar", "gor")

  const istenen = (istek.nextUrl.searchParams.get("tur") ?? "") as TanimTur
  const tur = GENEL_TANIM_TURLERI.includes(istenen) ? istenen : GENEL_TANIM_TURLERI[0]

  const kayitlar = await tanimlariGetir(tur)

  const icerik = csvOlustur(
    ["Sıra", "Kod", "Ad", "Kullanım", "Durum"],
    kayitlar.map((k) => [
      k.sira,
      k.kod ?? "",
      k.ad,
      k.kullanim,
      k.aktif ? "Aktif" : "Pasif",
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "tanimlar",
    aciklama: `Tanım listesi dışa aktarıldı: ${TUR_ADLARI[tur]} (${kayitlar.length} kayıt)`,
    yeniDeger: { tur },
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `tanimlar-${tur.toLowerCase()}-${bugun}.csv`)
}
