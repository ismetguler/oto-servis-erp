import type { NextRequest } from "next/server"

import { girisCikisAnaliziVerisi } from "../../veri"
import { csvOlustur, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("stok", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }

  const ozet = await girisCikisAnaliziVerisi(filtreler)

  const icerik = csvOlustur(
    ["Kod", "Ürün Adı", "Grup", "Giriş Miktar", "Çıkış Miktar", "Net Miktar", "Net Tutar"],
    ozet.stokKirilimi.map((s) => [
      s.kod,
      s.ad,
      s.urunGrubu,
      csvTutar(s.girisMiktar),
      csvTutar(s.cikisMiktar),
      csvTutar(s.netMiktar),
      csvTutar(s.netTutar),
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "stok_hareketleri",
    aciklama: `Giriş-Çıkış Analizi raporu dışa aktarıldı (${ozet.stokKirilimi.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `giris-cikis-analizi-${bugun}.csv`)
}
