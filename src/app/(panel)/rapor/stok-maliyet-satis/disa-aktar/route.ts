import type { NextRequest } from "next/server"

import { maliyetSatisVerisi } from "../../veri"
import { csvOlustur, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("stok", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }

  const satirlar = await maliyetSatisVerisi(filtreler)

  const icerik = csvOlustur(
    [
      "Kod",
      "Ürün Adı",
      "Grup",
      "Ortalama Maliyet",
      "Satış Fiyatı",
      "Fark",
      "Marj (%)",
      "Aralıkta Güncellendi",
    ],
    satirlar.map((s) => [
      s.kod,
      s.ad,
      s.urunGrubu,
      csvTutar(s.ortalamaMaliyet),
      csvTutar(s.satisFiyat),
      csvTutar(s.fark),
      csvTutar(s.marj),
      s.araliktaGuncellendi ? "Evet" : "Hayır",
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "stoklar",
    aciklama: `Stok Maliyet & Satış raporu dışa aktarıldı (${satirlar.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `stok-maliyet-satis-${bugun}.csv`)
}
