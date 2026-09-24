import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"

/**
 * Sayıma girecek stok listesi: aktif, silinmemiş, depo/ürün grubu
 * filtresine uyan kartlar. `/stok` listesindeki durum filtresi burada
 * yok — sayımın konusu zaten "aktif" stok, silinmiş/pasif kart sayılmaz.
 */
export function sayimStokKosulu(depoId: number | null, urunGrubu: string | null): Prisma.StokWhereInput {
  return {
    silindi: false,
    aktif: true,
    ...(depoId ? { depoId } : {}),
    ...(urunGrubu ? { urunGrubu } : {}),
  }
}

export async function sayimIcinStoklariGetir(depoId: number | null, urunGrubu: string | null) {
  return prisma.stok.findMany({
    where: sayimStokKosulu(depoId, urunGrubu),
    orderBy: { ad: "asc" },
    select: {
      id: true,
      kod: true,
      ad: true,
      birim: true,
      mevcutMiktar: true,
      depo: { select: { ad: true } },
    },
  })
}

/**
 * Fişin filtresine uyan ama fişte satırı OLMAYAN stoklar — "sayılmayanlar".
 * Fişin `depoId`/`urunGrubu` alanları saklandığı için filtre burada aynen
 * tekrar uygulanabiliyor.
 */
export async function sayilmayanStoklariGetir(fis: {
  id: number
  depoId: number | null
  urunGrubu: string | null
}) {
  return prisma.stok.findMany({
    where: {
      ...sayimStokKosulu(fis.depoId, fis.urunGrubu),
      sayimKalemleri: { none: { sayimFisiId: fis.id } },
    },
    orderBy: { ad: "asc" },
    select: { id: true, kod: true, ad: true, birim: true, mevcutMiktar: true },
  })
}

/** Kullanıcı id'lerinden ad-soyad haritası (Cari/Stok Hareketleri desenindeki aynı çözüm). */
export async function kullaniciAdiHaritasi(idler: (number | null | undefined)[]) {
  const gercekIdler = [...new Set(idler.filter((v): v is number => v != null))]
  if (!gercekIdler.length) return new Map<number, string>()
  const kullanicilar = await prisma.kullanici.findMany({
    where: { id: { in: gercekIdler } },
    select: { id: true, ad: true, soyad: true },
  })
  return new Map(kullanicilar.map((k) => [k.id, `${k.ad} ${k.soyad ?? ""}`.trim()]))
}
