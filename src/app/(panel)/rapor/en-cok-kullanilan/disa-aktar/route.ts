import type { NextRequest } from "next/server"

import { enCokKullanilanVerisi } from "../../veri"
import { csvOlustur, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("stok", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }

  const ozet = await enCokKullanilanVerisi(filtreler)

  const icerik = csvOlustur(
    ["Kod", "Ürün Adı", "Grup", "Depo", "Çıkış Miktar", "Çıkış Tutar", "İşlem Sayısı"],
    ozet.tutaraGoreSirali.map((s) => [
      s.kod,
      s.ad,
      s.urunGrubu,
      s.depoAdi,
      csvTutar(s.cikisMiktar),
      csvTutar(s.cikisTutar),
      String(s.islemSayisi),
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "stok_hareketleri",
    aciklama: `En Çok Kullanılan Parça raporu dışa aktarıldı (${ozet.tutaraGoreSirali.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `en-cok-kullanilan-${bugun}.csv`)
}
