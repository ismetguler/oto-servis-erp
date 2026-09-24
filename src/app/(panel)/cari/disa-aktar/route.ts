import type { NextRequest } from "next/server"

import { cariListeKosulu } from "../veri"
import { CARI_TIP_ADLARI, CARI_TUR_ADLARI } from "../sema"
import { csvOlustur, csvTarih, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"

/**
 * CARİ LİSTESİNİ EXCEL'E AKTAR
 *
 * Ekrandaki 50 satırlık sayfa değil, filtreye uyan TÜM kayıtlar iner —
 * muhasebeci "listeyi alıp kendi hesabımı yapayım" diyor, yarım liste işe
 * yaramaz. Kartın her alanı değil, dökümde işe yarayan sütunlar veriliyor.
 *
 * Dışa aktarma da loglanır: bir gün "müşteri listesi dışarı sızdı" denirse
 * kimin ne zaman indirdiği görülebilsin.
 */
export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("cari", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = {
    q: p.get("q") ?? "",
    tur: p.get("tur") ?? "",
    durum: p.get("durum") ?? "aktif",
    plasiyer: p.get("plasiyer") ?? "",
  }

  const kayitlar = await prisma.cari.findMany({
    where: cariListeKosulu(filtreler),
    orderBy: { unvan: "asc" },
    include: {
      plasiyer: { select: { unvan: true } },
      _count: { select: { araclar: true } },
    },
  })

  const icerik = csvOlustur(
    [
      "Kod",
      "Ünvan",
      "Tür",
      "Tipi",
      "VKN / TCKN",
      "Vergi Dairesi",
      "Yetkili",
      "Telefon",
      "Cep",
      "E-Posta",
      "İl",
      "İlçe",
      "Adres",
      "Sorumlu Personel",
      "Özel Kod",
      "Müşteri Sınıfı",
      "IBAN",
      "Vade (gün)",
      "Hesap Limiti",
      "Risk Limiti",
      "Araç Sayısı",
      "Bakiye",
      "Bakiye Durumu",
      "Kara Liste",
      "Aktif",
      "Kayıt Tarihi",
    ],
    kayitlar.map((c) => {
      const bakiye = Number(c.bakiye.toString())
      return [
        c.kod,
        c.unvan,
        CARI_TUR_ADLARI[c.turu],
        CARI_TIP_ADLARI[c.tipi],
        c.vergiNo,
        c.vergiDair,
        c.yetkili,
        c.telefon,
        c.gsm,
        c.email,
        c.il,
        c.ilce,
        c.adres,
        c.plasiyer?.unvan,
        c.ozelKod,
        c.musteriSinifi,
        c.ibanNo,
        c.vadeGun,
        csvTutar(c.hesapLimiti),
        csvTutar(c.riskLimiti),
        c._count.araclar,
        csvTutar(Math.abs(bakiye)),
        bakiye > 0 ? "BORÇ" : bakiye < 0 ? "ALACAK" : "",
        c.karaListe ? "EVET" : "",
        c.aktif ? "EVET" : "HAYIR",
        csvTarih(c.olusturmaTarihi),
      ]
    })
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "cariler",
    aciklama: `Cari listesi dışa aktarıldı (${kayitlar.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `cari-listesi-${bugun}.csv`)
}
