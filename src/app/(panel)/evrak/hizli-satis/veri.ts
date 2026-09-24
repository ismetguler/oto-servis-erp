import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"

/**
 * HIZLI SATIŞ / PERAKENDE — okuma yardımcıları (adım 9.3)
 *
 * Barkod okuma tarafı ayrı yazılmadı: Kabul Parça Çıkışı'ndaki `parcaOku`
 * motoru (`servis/parca-cikis/veri.ts`) burada da kullanılıyor — Stok Barkod
 * Arama (8.7) da aynı fonksiyonu sarmalıyor, üçüncü bir kopya açılmadı.
 */
export { parcaOku } from "@/app/(panel)/servis/parca-cikis/veri"
export type { BulunanParca } from "@/app/(panel)/servis/parca-cikis/veri"

/** Sabit kod — tek satırlık "sistem carisi", kod alanı `@unique` olduğu için tekilliği garanti eder. */
const PERAKENDE_MUSTERI_KODU = "PERAKENDE"

/**
 * Perakende satışta cari seçimi zorunlu değil (PROMPTLAR.md 9.3). Cari
 * seçilmezse satış bu sabit "Perakende Müşteri" carisine yazılır — Evrak/
 * Tahsilat/CariHareket şemalarının hepsi `cariId` zorunlu tuttuğu için ayrı
 * bir "cariId NULL" yolu açmak yerine (çok daha büyük bir şema/rapor
 * değişikliği gerektirirdi) Selpar'daki gibi tek bir genel müşteri kartı
 * kullanılıyor. İlk çağrıda oluşur, sonra hep aynı kayıt döner.
 */
export async function perakendeMusteriIdGetir(tx: Prisma.TransactionClient): Promise<number> {
  const mevcut = await tx.cari.findUnique({
    where: { kod: PERAKENDE_MUSTERI_KODU },
    select: { id: true, silindi: true },
  })
  if (mevcut) {
    if (mevcut.silindi) {
      await tx.cari.update({
        where: { id: mevcut.id },
        data: { silindi: false, silmeTarihi: null },
      })
    }
    return mevcut.id
  }

  const olusan = await tx.cari.create({
    data: {
      kod: PERAKENDE_MUSTERI_KODU,
      unvan: "Perakende Müşteri",
      turu: "MUSTERI",
    },
  })
  return olusan.id
}

/** Kasa gerektirmeyen (ör. az önce eklenmiş) durumlarda ekranda göstermek için. */
export async function perakendeMusteriGetir() {
  return prisma.cari.findUnique({
    where: { kod: PERAKENDE_MUSTERI_KODU },
    select: { id: true, kod: true, unvan: true },
  })
}
