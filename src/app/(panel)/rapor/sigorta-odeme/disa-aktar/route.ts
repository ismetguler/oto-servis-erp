import type { NextRequest } from "next/server"

import { sigortaOdemeVerisi } from "../../veri"
import { GARANTI_DURUM_ETIKETI } from "../../../servis/kabul/sema"
import { csvOlustur, csvTarih, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("rapor", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }

  const { satirlar } = await sigortaOdemeVerisi(filtreler)

  const icerik = csvOlustur(
    [
      "Kabul No",
      "Plaka",
      "Müşteri",
      "Garanti Veren",
      "Talep Tarihi",
      "Dosya No",
      "Onay No",
      "Durum",
      "Talep Edilen",
      "Kart Toplamı",
    ],
    satirlar.map((s) => [
      s.kabulNo,
      s.plaka,
      s.musteri,
      s.garantiVerenFirma,
      csvTarih(s.garantiTalepTarihi),
      s.garantiDosyaNo ?? "",
      s.garantiOnayNo ?? "",
      s.garantiDurumu
        ? (GARANTI_DURUM_ETIKETI[s.garantiDurumu as keyof typeof GARANTI_DURUM_ETIKETI] ?? s.garantiDurumu)
        : "",
      csvTutar(s.garantiTutar),
      csvTutar(s.genelToplam),
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "kabuller",
    aciklama: `Sigorta Ödeme raporu dışa aktarıldı (${satirlar.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `sigorta-odeme-${bugun}.csv`)
}
