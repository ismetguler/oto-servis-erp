import type { NextRequest } from "next/server"

import { satisTahsilatGetir, varsayilanDonem } from "../veri"
import { plaka } from "@/lib/bicim"
import { csvOlustur, csvTarih, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

/** Satış-Tahsilat raporunun iş bazlı dökümü — ekranla aynı hesaptan. */
export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("cari", "gor")

  const p = istek.nextUrl.searchParams
  const varsayilan = varsayilanDonem()
  const filtreler = {
    bas: p.get("bas") ?? varsayilan.bas,
    bit: p.get("bit") ?? varsayilan.bit,
    personel: p.get("personel") ?? "",
  }

  const kayitlar = await satisTahsilatGetir(filtreler)

  const satirlar = kayitlar.flatMap((k) =>
    k.satirlar.map((s) => [
      k.kod,
      k.unvan,
      k.gorevi,
      csvTarih(s.tarih),
      s.kabulNo,
      plaka(s.plaka),
      s.musteri,
      s.paydas > 1 ? `1/${s.paydas}` : "tam",
      csvTutar(s.satis),
      csvTutar(s.tahsilat),
      csvTutar(s.satis - s.tahsilat),
    ])
  )

  const icerik = csvOlustur(
    [
      "Kod",
      "Personel",
      "Görev",
      "Teslim Tarihi",
      "Kabul No",
      "Plaka",
      "Müşteri",
      "Pay",
      "Satış",
      "Tahsilat",
      "Kalan",
    ],
    satirlar
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "kabuller",
    aciklama: `Personel satış-tahsilat raporu dışa aktarıldı (${kayitlar.length} personel / ${satirlar.length} satır)`,
    yeniDeger: filtreler,
  })

  return csvYaniti(
    icerik,
    `personel-satis-tahsilat-${filtreler.bas}_${filtreler.bit}.csv`
  )
}
