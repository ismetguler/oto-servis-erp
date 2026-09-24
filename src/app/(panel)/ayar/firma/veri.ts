import "server-only"

import { prisma } from "@/lib/prisma"

/**
 * FİRMA BİLGİLERİ — okuma tarafı
 *
 * Tablo tek satırlık (`id` her zaman 1). Kayıt henüz yoksa `null` döner,
 * sayfa formu boş gösterir — "yeni kayıt" kavramı bilinçli olarak YOK.
 */
export async function firmaBilgisi() {
  return prisma.firma.findUnique({ where: { id: 1 } })
}
