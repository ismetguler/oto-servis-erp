import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { katalogAra } from "@/app/(panel)/servis/kabul/veri"
import { aramaKosullari } from "@/lib/arama"
import { prisma } from "@/lib/prisma"

/**
 * SATIŞ EVRAKI — okuma yardımcıları
 *
 * Kalem satırındaki "stok kartından seçim" için kabul modülündeki
 * `katalogAra`yı YENİDEN kullanıyoruz — parça arama mantığı (kod/ad/barkod,
 * satış fiyatı, KDV, mevcut miktar) burada tekrar yazılmadı.
 */
export { katalogAra }

/** Fatura formunda müşteri seçimi — personel hariç tüm cariler (Kabul'deki desenin aynısı). */
export async function satisCarileriGetir() {
  const cariler = await prisma.cari.findMany({
    where: { silindi: false, turu: { not: "PERSONEL" } },
    orderBy: { unvan: "asc" },
    select: { id: true, kod: true, unvan: true, bakiye: true, karaListe: true, karaListeNedeni: true },
  })
  return cariler.map((c) => ({ ...c, bakiye: Number(c.bakiye.toString()) }))
}

export type SatisCarisi = Awaited<ReturnType<typeof satisCarileriGetir>>[number]

/**
 * Satış evrak listesi — filtre: cari, tarih aralığı, durum.
 *
 * `tur` iki değeri birden kapsıyor: normal Satış Faturası (SATIS) ve Hızlı
 * Satış'ın (9.3) ürettiği PERAKENDE evrakı. Ayrı bir liste ekranı açmak
 * yerine ikisi burada birleşti — tabloya "Tür" sütunu eklendi, ayırt etmek
 * için ayrı sayfaya gitmeye gerek yok.
 */
export async function satisEvraklariGetir(f: {
  q?: string
  durum?: string
  bas?: string
  bit?: string
}) {
  return prisma.evrak.findMany({
    where: {
      silindi: false,
      // Adım 11.8: İade Faturası da (IADE_SATIS) bu liste/kart yapısını
      // paylaşıyor — ayrı bir sayfa açılmadı, "Tür" sütunu ayırt ediyor.
      tur: { in: ["SATIS", "PERAKENDE", "IADE_SATIS"] },
      ...(f.durum ? { durum: f.durum as "TASLAK" | "KESILDI" | "IPTAL" } : {}),
      ...(f.bas || f.bit
        ? {
            tarih: {
              ...(f.bas ? { gte: new Date(`${f.bas}T00:00:00`) } : {}),
              ...(f.bit ? { lte: new Date(`${f.bit}T23:59:59`) } : {}),
            },
          }
        : {}),
      ...(f.q
        ? {
            OR: aramaKosullari<Prisma.EvrakWhereInput>(["evrakNo", "cari.unvan"], f.q),
          }
        : {}),
    },
    orderBy: { tarih: "desc" },
    include: { cari: { select: { unvan: true, kod: true } } },
  })
}

/** Evrak kartı + kalemleri (detay ekranı). */
export async function evrakDetayiGetir(id: number) {
  return prisma.evrak.findUnique({
    where: { id },
    include: {
      cari: {
        select: {
          id: true,
          kod: true,
          unvan: true,
          bakiye: true,
          // Adım 11.8 baskı şablonları (fatura başlığındaki müşteri kimlik/
          // adres bilgisi) için — liste ekranı bu alanları kullanmıyor,
          // yalnız detay/print tarafı.
          vergiNo: true,
          vergiDair: true,
          adres: true,
          il: true,
          ilce: true,
          telefon: true,
          gsm: true,
          yetkili: true,
        },
      },
      // Servis faturası çıktısında araç bloğu (12.4b) — kabule bağlı
      // evrakta plaka/şase/marka/model/km basılabilsin diye.
      kabul: {
        select: {
          id: true,
          kabulNo: true,
          girisTarihi: true,
          girisKm: true,
          arac: {
            select: {
              plaka: true,
              saseNo: true,
              marka: true,
              model: true,
              modelYili: true,
              renk: true,
              sonKm: true,
            },
          },
        },
      },
      // Siparişten dönüştürülmüş fatura (adım 9.7) — kaynağa geri bağlantı.
      siparis: { select: { id: true, siparisNo: true, tip: true } },
      kalemler: { orderBy: { sira: "asc" } },
    },
  })
}

// ============================================================================
//  KABULDEN FATURAYA DÖNÜŞTÜRME (adım 9.2)
// ============================================================================

/**
 * Faturaya dönüştürülecek kabul kartını okur (form ön dolumu + doğrulama).
 * Kalemler `null` dönmez; boş kart da olabilir — "satırı olmayan kart
 * faturalanamaz" kuralı action tarafında kontrol ediliyor.
 */
export async function faturalanacakKabulGetir(kabulId: number) {
  return prisma.kabul.findUnique({
    where: { id: kabulId },
    select: {
      id: true,
      kabulNo: true,
      durum: true,
      silindi: true,
      cariId: true,
      faturaKesildi: true,
      kdvDahilGirilir: true,
      genelToplam: true,
      cari: { select: { id: true, kod: true, unvan: true } },
      arac: { select: { plaka: true, marka: true, model: true } },
      kalemler: { orderBy: { sira: "asc" } },
    },
  })
}

/**
 * Bir kabul kartına bağlı, HÂLÂ GEÇERLİ (iptal edilmemiş, silinmemiş) fatura.
 * "Bu kart ikinci kez faturalanmasın" kuralının tek kaynağı burası — hem
 * kabul kartındaki düğme hem de `evrakKaydet` aynı sorguyu kullanıyor.
 */
export async function kabulunFaturasi(kabulId: number) {
  return prisma.evrak.findFirst({
    where: { kabulId, silindi: false, durum: { not: "IPTAL" } },
    select: { id: true, evrakNo: true, durum: true },
  })
}
