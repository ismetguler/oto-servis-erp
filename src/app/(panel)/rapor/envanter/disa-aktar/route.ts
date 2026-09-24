import type { NextRequest } from "next/server"

import { envanterVerisi } from "../../veri"
import { csvOlustur, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("stok", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }
  const depoId = p.get("depo") ?? ""

  const satirlar = await envanterVerisi(filtreler, depoId || undefined)

  const icerik = csvOlustur(
    ["Kod", "Ürün Adı", "Depo", "Raf", "Birim", "Mevcut Miktar", "Birim Maliyet", "Toplam Değer", "Aralıkta Güncellendi"],
    satirlar.map((s) => [
      s.kod,
      s.ad,
      s.depoAdi,
      s.rafYeri ?? "",
      s.birim,
      csvTutar(s.mevcutMiktar),
      csvTutar(s.ortalamaMaliyet),
      csvTutar(s.toplamDeger),
      s.araliktaGuncellendi ? "Evet" : "Hayır",
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "stoklar",
    aciklama: `Envanter raporu dışa aktarıldı (${satirlar.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `envanter-${bugun}.csv`)
}
