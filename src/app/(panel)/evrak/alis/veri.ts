import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { evrakDetayiGetir } from "../satis/veri"
import { aramaKosullari } from "@/lib/arama"
import { prisma } from "@/lib/prisma"

/**
 * ALIŞ EVRAKI — okuma yardımcıları
 *
 * `evrakDetayiGetir` satış tarafında zaten `tur`e göre filtre yapmıyor
 * (sadece `id`) — bu yüzden burada yeniden yazılmadı, doğrudan yeniden
 * kullanıldı. `tur !== "ALIS"` kontrolü sayfa seviyesinde (`notFound()`).
 */
export { evrakDetayiGetir }

/**
 * Fatura formunda tedarikçi seçimi — personel VE sabit "Perakende Müşteri"
 * kartı hariç tüm cariler. Perakende kartı yalnız Hızlı Satış'ın otomatik
 * kullandığı sentetik müşteri; tedarikçi olamayacağı için alış formunda
 * gösterilmiyor (satış formu ise onu listeliyor).
 */
export async function alisCarileriGetir() {
  const cariler = await prisma.cari.findMany({
    where: { silindi: false, turu: { not: "PERSONEL" }, kod: { not: "PERAKENDE" } },
    orderBy: { unvan: "asc" },
    select: { id: true, kod: true, unvan: true, bakiye: true },
  })
  return cariler.map((c) => ({ ...c, bakiye: Number(c.bakiye.toString()) }))
}

export type AlisCarisi = Awaited<ReturnType<typeof alisCarileriGetir>>[number]

/** Alış evrak listesi — filtre: cari, tarih aralığı, durum. */
export async function alisEvraklariGetir(f: {
  q?: string
  durum?: string
  bas?: string
  bit?: string
}) {
  return prisma.evrak.findMany({
    where: {
      silindi: false,
      tur: { in: ["ALIS", "IADE_ALIS"] },
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

/**
 * Kalem satırındaki "stok kartından seçim" için kabul/satış modülündeki
 * `katalogAra`dan FARKLI: burada satır fiyatı `alisFiyat` üzerinden
 * öneriliyor — satış fiyatını öneren ortak fonksiyon alışta yanlış
 * rakamla dolduracağı için bilinçli olarak yeniden yazıldı.
 */
export async function katalogAraAlis(q: string) {
  const arama = q.trim()
  if (arama.length < 2) return []

  const kayitlar = await prisma.stok.findMany({
    where: {
      silindi: false,
      aktif: true,
      OR: [
        ...aramaKosullari<Prisma.StokWhereInput>(
          ["kod", "ad", "barkod", "orijinalKodu"],
          arama
        ),
      ],
    },
    orderBy: { ad: "asc" },
    take: 20,
    select: {
      id: true,
      kod: true,
      ad: true,
      birim: true,
      alisFiyat: true,
      kdvOrani: true,
      mevcutMiktar: true,
    },
  })

  return kayitlar.map((s) => ({
    id: s.id,
    kod: s.kod,
    ad: s.ad,
    birim: s.birim,
    fiyat: Number(s.alisFiyat.toString()),
    kdvOrani: Number(s.kdvOrani.toString()),
    stokta: Number(s.mevcutMiktar.toString()),
  }))
}

/**
 * SA-3.1 "Kimden ne aldık" — bir cariye KESİLMİŞ alış (ve alış iade)
 * faturalarının kalem dökümü. Cari türüne (MUSTERI/TEDARIKCI) bilerek
 * BAKILMIYOR: alış faturası zaten türden bağımsız kesiliyor (bkz.
 * `alisCarileriGetir`), dolayısıyla "Müşteri" etiketli bir kartta bile
 * alım varsa geçmişi burada görünür — enum'a HER_IKISI eklemeye gerek
 * kalmadan "hem müşteri hem tedarikçi" senaryosunu karşılıyor.
 * İkinci bir sorgu deseni yazılmadı; cari kartı bu tek fonksiyonu çağırıyor.
 */
export async function cariAlisKalemleriGetir(cariId: number, limit = 50) {
  const kalemler = await prisma.evrakKalem.findMany({
    where: {
      evrak: {
        cariId,
        tur: { in: ["ALIS", "IADE_ALIS"] },
        durum: "KESILDI",
        silindi: false,
      },
    },
    orderBy: [{ evrak: { tarih: "desc" } }, { evrakId: "desc" }, { sira: "asc" }],
    take: limit,
    select: {
      id: true,
      aciklama: true,
      miktar: true,
      birim: true,
      birimFiyat: true,
      toplam: true,
      evrak: { select: { id: true, evrakNo: true, tarih: true, tur: true } },
      stok: { select: { kod: true } },
    },
  })

  return kalemler.map((k) => ({
    id: k.id,
    ad: k.aciklama,
    stokKodu: k.stok?.kod ?? null,
    miktar: Number(k.miktar.toString()),
    birim: k.birim,
    birimFiyat: Number(k.birimFiyat.toString()),
    toplam: Number(k.toplam.toString()),
    iade: k.evrak.tur === "IADE_ALIS",
    evrakId: k.evrak.id,
    evrakNo: k.evrak.evrakNo,
    tarih: k.evrak.tarih,
  }))
}
