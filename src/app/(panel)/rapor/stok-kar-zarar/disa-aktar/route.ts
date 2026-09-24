import type { NextRequest } from "next/server"

import { stokKarZararVerisi } from "../../veri"
import { csvOlustur, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("stok", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }

  const ozet = await stokKarZararVerisi(filtreler)

  const icerik = csvOlustur(
    ["Kod", "Ürün Adı", "Grup", "Satış Miktarı", "Satış Tutarı", "Maliyet", "Kâr", "Kâr Marjı (%)"],
    ozet.satirlar.map((s) => [
      s.kod,
      s.ad,
      s.urunGrubu,
      csvTutar(s.satisMiktari),
      csvTutar(s.satisTutari),
      csvTutar(s.maliyet),
      csvTutar(s.kar),
      csvTutar(s.karMarji),
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "stoklar",
    aciklama: `Stok Kâr-Zarar raporu dışa aktarıldı (${ozet.satirlar.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `stok-kar-zarar-${bugun}.csv`)
}
