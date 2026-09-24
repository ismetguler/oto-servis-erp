import "server-only"

import { prisma } from "@/lib/prisma"

/**
 * Araç marka/model kataloğu (SA-5 / madde 15) — forma verilecek hâli.
 *
 * `markalar` alfabetik marka listesi, `modelHaritasi` her marka için
 * alfabetik model dizisi. Tüm katalog (~1200 satır) tek seferde istemciye
 * gider; marka→model bağı olduğu için parça parça çekmek yerine haritayı
 * bir kez göndermek en sade yol.
 *
 * Hem stok kartı ("Araca Özel Parça" tipi) hem araç kartı (marka/model
 * alanları) bu tek kaynaktan beslenir.
 */
export async function aracKatalogVerisi() {
  const satirlar = await prisma.aracModelKatalog.findMany({
    where: { aktif: true },
    orderBy: [{ marka: "asc" }, { model: "asc" }],
    select: { marka: true, model: true },
  })

  const modelHaritasi: Record<string, string[]> = {}
  for (const s of satirlar) {
    ;(modelHaritasi[s.marka] ??= []).push(s.model)
  }

  return { markalar: Object.keys(modelHaritasi), modelHaritasi }
}

export type AracKatalog = Awaited<ReturnType<typeof aracKatalogVerisi>>
