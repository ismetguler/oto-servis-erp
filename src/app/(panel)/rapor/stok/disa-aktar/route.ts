import type { NextRequest } from "next/server"

import { stokSonDurumVerisi } from "../../veri"
import { csvOlustur, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("stok", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }

  const ozet = await stokSonDurumVerisi(filtreler)

  const icerik = csvOlustur(
    ["Kırılım", "Adı", "Kart Sayısı", "Toplam Değer"],
    [
      ...ozet.depoKirilimi.map((k) => ["Depo", k.anahtar, String(k.urunSayisi), csvTutar(k.toplamDeger)]),
      ...ozet.grupKirilimi.map((k) => ["Ürün Grubu", k.anahtar, String(k.urunSayisi), csvTutar(k.toplamDeger)]),
    ]
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "stoklar",
    aciklama: `Stok Son Durum raporu dışa aktarıldı (${ozet.toplamUrunSayisi} kart)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `stok-son-durum-${bugun}.csv`)
}
