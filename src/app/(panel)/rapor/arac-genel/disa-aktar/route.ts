import type { NextRequest } from "next/server"

import { aracGenelVerisi } from "../../veri"
import { csvOlustur, csvTarih, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("rapor", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }

  const satirlar = await aracGenelVerisi(filtreler)

  const icerik = csvOlustur(
    [
      "Plaka",
      "Marka/Model",
      "Müşteri",
      "Kabul Sayısı",
      "Toplam Harcama",
      "İlk Kayıt",
      "Son Giriş",
      "Son Teslim",
    ],
    satirlar.map((s) => [
      s.plaka,
      s.markaModel,
      s.musteri,
      s.kabulSayisi,
      csvTutar(s.genelToplam),
      csvTarih(s.ilkKayitTarihi),
      csvTarih(s.sonGirisTarihi),
      csvTarih(s.sonTeslimTarihi),
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "araclar",
    aciklama: `Araç Genel raporu dışa aktarıldı (${satirlar.length} araç)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `arac-genel-${bugun}.csv`)
}
