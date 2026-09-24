import type { NextRequest } from "next/server"

import { cariHareketRaporuVerisi } from "../../veri"
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

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }
  const cariAra = p.get("cari") ?? ""

  const satirlar = await cariHareketRaporuVerisi(filtreler, cariAra)

  const icerik = csvOlustur(
    ["Tarih", "Cari Kod", "Ünvan", "Tür", "Açıklama", "Vade", "Borç", "Alacak"],
    satirlar.map((s) => [
      csvTarih(s.tarih),
      s.cariKod,
      s.cariUnvan,
      HAREKET_ADI[s.tur] ?? s.tur,
      s.aciklama ?? "",
      csvTarih(s.vadeTarihi),
      csvTutar(s.borc),
      csvTutar(s.alacak),
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "cari_hareketleri",
    aciklama: `Cari Hareket raporu dışa aktarıldı (${satirlar.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `cari-hareket-${bugun}.csv`)
}
