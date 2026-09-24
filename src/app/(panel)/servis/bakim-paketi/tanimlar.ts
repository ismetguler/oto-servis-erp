import "server-only"

import type { TanimTur } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

/**
 * Paket formundaki `datalist` önerilerini besler.
 * Araç türü ve marka pakette serbest metin tutuluyor (paket bir şablon,
 * zorlayıcı değil); yine de kullanıcı mevcut tanımlardan seçebilsin diye
 * `Tanim` tablosundaki adlar öneri olarak veriliyor.
 */
export async function tanimAdlari(tur: TanimTur): Promise<string[]> {
  const kayitlar = await prisma.tanim.findMany({
    where: { tur, aktif: true },
    orderBy: [{ sira: "asc" }, { ad: "asc" }],
    select: { ad: true },
  })
  return kayitlar.map((k) => k.ad)
}
