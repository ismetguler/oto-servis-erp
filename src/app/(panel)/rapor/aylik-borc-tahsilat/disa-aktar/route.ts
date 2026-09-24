import type { NextRequest } from "next/server"

import { aylikBorcTahsilatVerisi } from "../../veri"
import { csvOlustur, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("cari", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }

  const satirlar = await aylikBorcTahsilatVerisi(filtreler)

  const icerik = csvOlustur(
    ["Ay", "Doğan Borç", "Tahsilat", "Tahsilat Oranı (%)"],
    satirlar.map((s) => [
      s.ayEtiketi,
      csvTutar(s.borcDogan),
      csvTutar(s.tahsilat),
      s.borcDogan ? s.tahsilatOrani.toFixed(1).replace(".", ",") : "0,0",
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "cari_hareketleri",
    aciklama: `Aylık Borç Tahsilat raporu dışa aktarıldı (${satirlar.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `aylik-borc-tahsilat-${bugun}.csv`)
}
