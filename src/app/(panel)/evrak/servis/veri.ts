import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { aramaKosullari } from "@/lib/arama"
import { prisma } from "@/lib/prisma"
import { plakaSadelestir } from "@/lib/plaka"

/**
 * SERVİS FATURALARI — okuma yardımcıları (adım 11.10)
 *
 * Bu ekran YENİ bir fatura türü getirmiyor. Kabulden faturaya dönüştürme
 * (adım 9.2) zaten `Evrak.kabulId` ile çalışıyor ve ürettiği evrak normal
 * bir SATIS faturası. Servis faturası = "kabul kartına bağlı fatura"
 * kesitidir; ayrı tablo/tür açmak, kesinleştirme–iptal–stok mantığını
 * (`evrak/satis/actions.ts`) ikinci kez yazmak demek olurdu.
 *
 * Ekran iki soruyu birden cevaplıyor:
 *  1. Hangi işler faturalandı?      → `servisFaturalariGetir`
 *  2. Hangi kapanan iş bekliyor?    → `faturaBekleyenKabullerGetir`
 * Servis müdürünün gün sonunda sorduğu soru ikincisi; kapalı onarım
 * listesinde bu kesit filtreyle bulunuyordu, burada varsayılan görünüm.
 */

export type ServisFaturaFiltreleri = {
  q?: string
  durum?: string
  bas?: string
  bit?: string
}

/** Filtre metnini tarih aralığı koşuluna çevirir (satış listesindeki desenin aynısı). */
function tarihAraligi(bas?: string, bit?: string) {
  if (!bas && !bit) return undefined
  return {
    ...(bas ? { gte: new Date(`${bas}T00:00:00`) } : {}),
    ...(bit ? { lte: new Date(`${bit}T23:59:59`) } : {}),
  }
}

/**
 * Kabul kartına bağlı faturalar.
 *
 * `tur` süzgeci yok: bağlayıcı olan `kabulId`. Bir servis işine kesilmiş
 * fatura SATIS türündedir, ama kart iptal edilip iade kesilirse
 * (IADE_SATIS) o da aynı işin evrakıdır ve bu listede görünmelidir.
 */
export async function servisFaturalariGetir(f: ServisFaturaFiltreleri) {
  const aralik = tarihAraligi(f.bas, f.bit)
  const q = (f.q ?? "").trim()

  return prisma.evrak.findMany({
    where: {
      silindi: false,
      kabulId: { not: null },
      ...(f.durum ? { durum: f.durum as "TASLAK" | "KESILDI" | "IPTAL" } : {}),
      ...(aralik ? { tarih: aralik } : {}),
      ...(q
        ? {
            OR: [
              ...aramaKosullari<Prisma.EvrakWhereInput>(
                ["evrakNo", "cari.unvan", "kabul.kabulNo"],
                q
              ),
              {
                kabul: { arac: { plaka: { contains: plakaSadelestir(q), mode: "insensitive" } } },
              },
            ],
          }
        : {}),
    },
    orderBy: { tarih: "desc" },
    select: {
      id: true,
      evrakNo: true,
      tur: true,
      durum: true,
      tarih: true,
      genelToplam: true,
      cari: { select: { kod: true, unvan: true } },
      kabul: {
        select: {
          id: true,
          kabulNo: true,
          arac: { select: { plaka: true, marka: true, model: true } },
        },
      },
    },
  })
}

export type ServisFaturasi = Awaited<ReturnType<typeof servisFaturalariGetir>>[number]

/**
 * Faturası kesilmemiş, teslim edilmiş kabul kartları.
 *
 * "Faturalanmış sayılma" ölçütü `Kabul.faturaKesildi` DEĞİL, kartta geçerli
 * bir evrak bulunup bulunmaması: `faturaKesildi` yalnız fatura
 * KESİNLEŞTİRİLDİĞİNDE true oluyor, dolayısıyla taslak faturası olan bir
 * kart bu listede kalır ve ikinci kez dönüştürülmeye çalışılırdı
 * (`evrakKaydet` reddeder ama kullanıcı boşuna tıklamış olur). Koşul
 * `veri.ts → kabulunFaturasi` ile birebir aynı: silinmemiş ve iptal
 * olmayan evrak varsa kart faturalanmıştır.
 *
 * Satırı olmayan kart da dışarıda: `evrakKaydet` "satırı olmayan kabul
 * faturalanamaz" diyerek zaten reddediyor.
 */
export async function faturaBekleyenKabullerGetir(f: ServisFaturaFiltreleri) {
  const aralik = tarihAraligi(f.bas, f.bit)
  const q = (f.q ?? "").trim()

  return prisma.kabul.findMany({
    where: {
      silindi: false,
      durum: "TESLIM_EDILDI",
      kalemler: { some: {} },
      evraklar: { none: { silindi: false, durum: { not: "IPTAL" } } },
      ...(aralik ? { teslimTarihi: aralik } : {}),
      ...(q
        ? {
            OR: [
              ...aramaKosullari<Prisma.KabulWhereInput>(["kabulNo", "cari.unvan"], q),
              { arac: { plaka: { contains: plakaSadelestir(q), mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { teslimTarihi: "desc" },
    select: {
      id: true,
      kabulNo: true,
      teslimTarihi: true,
      genelToplam: true,
      cari: { select: { kod: true, unvan: true } },
      arac: { select: { plaka: true, marka: true, model: true } },
    },
  })
}

export type FaturaBekleyenKabul = Awaited<
  ReturnType<typeof faturaBekleyenKabullerGetir>
>[number]
