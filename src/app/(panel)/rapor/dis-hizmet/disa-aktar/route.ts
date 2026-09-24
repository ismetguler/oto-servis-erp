import type { NextRequest } from "next/server"

import { disHizmetVerisi } from "../../veri"
import { csvOlustur, csvTarih, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("rapor", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }

  const satirlar = await disHizmetVerisi(filtreler)

  const icerik = csvOlustur(
    ["Kabul No", "Teslim Tarihi", "Plaka", "Müşteri", "Açıklama", "Miktar", "Tutar"],
    satirlar.map((s) => [
      s.kabulNo,
      csvTarih(s.teslimTarihi),
      s.plaka,
      s.musteri,
      s.aciklama,
      csvTutar(s.miktar),
      csvTutar(s.tutar),
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "kabul_kalemleri",
    aciklama: `Dış Hizmet raporu dışa aktarıldı (${satirlar.length} kalem)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `dis-hizmet-${bugun}.csv`)
}
