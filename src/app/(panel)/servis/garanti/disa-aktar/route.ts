import type { NextRequest } from "next/server"

import { firmayaGoreGrupla, garantiKayitlariGetir, garantiListeKosulu } from "../veri"
import { GARANTI_DURUM_ETIKETI } from "../../kabul/sema"
import { csvOlustur, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

const KABUL_DURUMU: Record<string, string> = {
  ACIK: "Açık",
  BEKLEMEDE: "Beklemede",
  TAMAMLANDI: "Tamamlandı",
  TESLIM_EDILDI: "Teslim Edildi",
  IPTAL: "İptal",
}

/** GARANTİ LİSTESİNİ EXCEL'E AKTAR — ekrandaki filtrenin aynısı geçerli. */
export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("kabul", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = {
    q: p.get("q") ?? "",
    firma: p.get("firma") ?? "",
    durum: p.get("durum") ?? "",
    tahsilat: p.get("tahsilat") ?? "",
    bas: p.get("bas") ?? "",
    bit: p.get("bit") ?? "",
  }

  const kayitlar = await garantiKayitlariGetir(garantiListeKosulu(filtreler))
  // Ekranda firma bazında gruplu görünüyor; CSV'de de aynı sırayla çıksın ki
  // iki çıktı karşılaştırılabilsin.
  const sirali = firmayaGoreGrupla(kayitlar).flatMap((g) => g.kayitlar)

  const icerik = csvOlustur(
    [
      "Garanti Veren Firma",
      "Kabul No",
      "Plaka",
      "Araç",
      "Müşteri",
      "Giriş Tarihi",
      "Teslim Tarihi",
      "Garanti Dosya No",
      "Onay No",
      "Talep Tarihi",
      "Takip Durumu",
      "Kart Durumu",
      "Kart Türü",
      "Garanti Tutarı",
      "İş Toplamı",
      "Fatura Kesildi",
      "Tahsil Edildi",
      "Not",
    ],
    sirali.map((k) => [
      k.garantiVeren?.unvan ?? "Firma girilmemiş",
      k.kabulNo,
      k.arac.plaka,
      [k.arac.marka, k.arac.model].filter(Boolean).join(" "),
      k.cari.unvan,
      k.girisTarihi.toLocaleDateString("tr-TR"),
      k.teslimTarihi?.toLocaleDateString("tr-TR"),
      k.garantiDosyaNo,
      k.garantiOnayNo,
      k.garantiTalepTarihi?.toLocaleDateString("tr-TR"),
      k.garantiDurumu
        ? (GARANTI_DURUM_ETIKETI[k.garantiDurumu as keyof typeof GARANTI_DURUM_ETIKETI] ??
          k.garantiDurumu)
        : "",
      KABUL_DURUMU[k.durum] ?? k.durum,
      k.kartTuru,
      csvTutar(k.garantiTutar),
      csvTutar(k.genelToplam),
      k.faturaKesildi ? "EVET" : "HAYIR",
      k.odendi ? "EVET" : "HAYIR",
      k.garantiNotu,
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "kabuller",
    aciklama: `Garanti listesi dışa aktarıldı (${sirali.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `garanti-listesi-${bugun}.csv`)
}
