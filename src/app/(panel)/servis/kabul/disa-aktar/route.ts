import type { NextRequest } from "next/server"

import { kabulListeKosulu } from "../veri"
import { csvOlustur, csvTarih, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"

const DURUM_ETIKETI: Record<string, string> = {
  ACIK: "Açık",
  BEKLEMEDE: "Beklemede",
  TAMAMLANDI: "Tamamlandı",
  TESLIM_EDILDI: "Teslim Edildi",
  IPTAL: "İptal",
}

/** KABUL LİSTESİNİ EXCEL'E AKTAR — ekrandaki filtrenin aynısı kullanılır. */
export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("kabul", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = {
    q: p.get("q") ?? "",
    durum: p.get("durum") ?? "hepsi",
    bas: p.get("bas") ?? "",
    bit: p.get("bit") ?? "",
    formen: p.get("formen") ?? "",
    fatura: p.get("fatura") ?? "",
  }

  const kayitlar = await prisma.kabul.findMany({
    where: kabulListeKosulu(filtreler),
    orderBy: { girisTarihi: "desc" },
    include: {
      arac: { select: { plaka: true, marka: true, model: true } },
      cari: { select: { kod: true, unvan: true } },
      formen: { select: { ad: true, soyad: true } },
    },
  })

  const icerik = csvOlustur(
    [
      "Kabul No",
      "Özel No",
      "Durum",
      "Kart Türü",
      "Plaka",
      "Marka",
      "Model",
      "Cari Kodu",
      "Müşteri",
      "Giriş Tarihi",
      "Giriş Km",
      "Tahmini Teslim",
      "Teslim Tarihi",
      "İlgilenecek Usta",
      "Şikâyet",
      "Parça Toplam",
      "İşçilik Toplam",
      "Ara Toplam",
      "KDV",
      "Genel Toplam",
      "Faturası Kesildi",
      "Tahsil Edildi",
    ],
    kayitlar.map((k) => [
      k.kabulNo,
      k.kabulOzelNo,
      DURUM_ETIKETI[k.durum] ?? k.durum,
      k.kartTuru,
      k.arac.plaka,
      k.arac.marka,
      k.arac.model,
      k.cari.kod,
      k.cari.unvan,
      csvTarih(k.girisTarihi),
      k.girisKm,
      csvTarih(k.tahminiTeslimTarihi),
      csvTarih(k.teslimTarihi),
      k.formen ? [k.formen.ad, k.formen.soyad].filter(Boolean).join(" ") : "",
      k.sikayet,
      csvTutar(k.parcaToplam),
      csvTutar(k.iscilikToplam),
      csvTutar(k.araToplam),
      csvTutar(k.kdvToplam),
      csvTutar(k.genelToplam),
      k.faturaKesildi ? "EVET" : "HAYIR",
      k.odendi ? "EVET" : "HAYIR",
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "kabuller",
    aciklama: `Kabul listesi dışa aktarıldı (${kayitlar.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `kabul-listesi-${bugun}.csv`)
}
