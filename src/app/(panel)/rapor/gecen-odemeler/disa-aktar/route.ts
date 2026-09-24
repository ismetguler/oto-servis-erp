import type { NextRequest } from "next/server"

import { gecenOdemelerVerisi } from "../../veri"
import { CARI_TUR_ADLARI } from "../../../cari/sema"
import { csvOlustur, csvTarih, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

const HAREKET_ADI: Record<string, string> = {
  ACILIS: "Açılış",
  EVRAK: "Fatura",
  KABUL: "Servis",
  TAHSILAT: "Tahsilat",
  TEDIYE: "Ödeme",
  MAHSUP: "Mahsup",
  CEK_SENET: "Çek/Senet",
}

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("cari", "gor")

  const asOf = istek.nextUrl.searchParams.get("asOf") ?? ""

  const satirlar = await gecenOdemelerVerisi(asOf)

  const icerik = csvOlustur(
    ["Kod", "Ünvan", "Tür", "Kaynak", "Açıklama", "Vade", "Gecikme (Gün)", "Tutar"],
    satirlar.map((s) => [
      s.cariKod,
      s.cariUnvan,
      CARI_TUR_ADLARI[s.turu as keyof typeof CARI_TUR_ADLARI] ?? s.turu,
      HAREKET_ADI[s.tur] ?? s.tur,
      s.aciklama ?? "",
      csvTarih(s.vadeTarihi),
      s.gunGecikme,
      csvTutar(s.tutar),
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "cari_hareketleri",
    aciklama: `Ödemesi Geçenler raporu dışa aktarıldı (${satirlar.length} kayıt)`,
    yeniDeger: { asOf },
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `odemesi-gecenler-${bugun}.csv`)
}
