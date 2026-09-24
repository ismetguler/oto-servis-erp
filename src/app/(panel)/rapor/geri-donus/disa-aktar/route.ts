import type { NextRequest } from "next/server"

import { geriDonusVerisi } from "../../veri"
import { csvOlustur, csvTarih, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("rapor", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }

  const satirlar = await geriDonusVerisi(filtreler)

  const icerik = csvOlustur(
    [
      "Plaka",
      "Müşteri",
      "İlk Kabul No",
      "İlk Teslim Tarihi",
      "Şikayet",
      "Yapılan İşler",
      "İkinci Kabul No",
      "İkinci Giriş Tarihi",
      "Gün Farkı",
    ],
    satirlar.map((s) => [
      s.plaka,
      s.musteri,
      s.ilkKabulNo,
      csvTarih(s.ilkTeslimTarihi),
      s.ilkSikayet ?? "",
      s.ilkYapilanIsler ?? "",
      s.ikinciKabulNo,
      csvTarih(s.ikinciGirisTarihi),
      s.gunFarki,
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "kabuller",
    aciklama: `Geri Dönüş raporu dışa aktarıldı (${satirlar.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `geri-donus-${bugun}.csv`)
}
