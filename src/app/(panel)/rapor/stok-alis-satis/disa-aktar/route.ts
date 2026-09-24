import type { NextRequest } from "next/server"

import { stokAlisSatisVerisi } from "../../veri"
import { csvOlustur, csvTarih, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

const YON_ETIKETI: Record<string, string> = {
  ALIS: "Alış",
  SATIS: "Satış",
  IADE_ALIS: "İade (Alış)",
  IADE_SATIS: "İade (Satış)",
}

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("stok", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }
  const urunAra = p.get("urun") ?? ""

  const satirlar = await stokAlisSatisVerisi(filtreler, urunAra)

  const icerik = csvOlustur(
    ["Tarih", "Kod", "Ürün Adı", "Yön", "Kaynak", "Belge No", "Miktar", "Birim Fiyat", "Tutar"],
    satirlar.map((s) => [
      csvTarih(s.tarih),
      s.kod,
      s.ad,
      YON_ETIKETI[s.yon],
      s.kaynak,
      s.belgeNo,
      csvTutar(s.miktar),
      csvTutar(s.birimFiyat),
      csvTutar(s.tutar),
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "stoklar",
    aciklama: `Stok Alış-Satış raporu dışa aktarıldı (${satirlar.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `stok-alis-satis-${bugun}.csv`)
}
