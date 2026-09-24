import type { NextRequest } from "next/server"

import { projeRaporVerisi } from "../../veri"
import { csvOlustur, csvTarih, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

/**
 * PROJE RAPORUNU EXCEL'E AKTAR.
 * Ekrandaki filtrenin ve grup sırasının aynısını kullanır — iki çıktı
 * karşılaştırılabilsin diye (Garanti Listesi'nde alınan karar).
 */
export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("kabul", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = {
    proje: p.get("proje") ?? "",
    q: p.get("q") ?? "",
    durum: p.get("durum") ?? "",
    bas: p.get("bas") ?? "",
    bit: p.get("bit") ?? "",
  }

  const gruplar = await projeRaporVerisi(filtreler)

  const satirlar = gruplar.flatMap((g) =>
    g.satirlar.map((s) => [
      g.proje,
      s.kabulNo,
      csvTarih(s.girisTarihi),
      s.teslimTarihi ? csvTarih(s.teslimTarihi) : "",
      s.plaka,
      [s.marka, s.model].filter(Boolean).join(" "),
      s.musteri,
      s.filoSirketi,
      s.durum,
      csvTutar(s.parcaToplam),
      csvTutar(s.iscilikToplam),
      csvTutar(s.genelToplam),
      s.faturaKesildi ? "EVET" : "HAYIR",
    ])
  )

  const icerik = csvOlustur(
    [
      "Proje",
      "Kabul No",
      "Giriş Tarihi",
      "Teslim Tarihi",
      "Plaka",
      "Marka / Model",
      "Müşteri",
      "Filo Şirketi",
      "Durum",
      "Parça Toplamı",
      "İşçilik Toplamı",
      "Genel Toplam",
      "Faturası Kesildi",
    ],
    satirlar
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "kabuller",
    aciklama: `Proje raporu dışa aktarıldı (${gruplar.length} proje, ${satirlar.length} kabul)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `proje-raporu-${bugun}.csv`)
}
