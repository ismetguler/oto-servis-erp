import "server-only"

import { prisma } from "@/lib/prisma"

/**
 * Ayarlar > Araç Modelleri ekranının verisi.
 *  - `markalar`: tüm markalar + model sayısı (hazır + elle birlikte), referans
 *  - `elle`: yalnızca elle eklenmiş (kilitli = false) satırlar — düzenlenebilir
 *  - `hazirSayi` / `elleSayi`: üst bilgi rozetleri
 */
export async function aracModelEkraniVerisi() {
  const [gruplar, elle, hazirSayi] = await Promise.all([
    prisma.aracModelKatalog.groupBy({
      by: ["marka"],
      _count: { _all: true },
      orderBy: { marka: "asc" },
    }),
    prisma.aracModelKatalog.findMany({
      where: { kilitli: false },
      orderBy: [{ marka: "asc" }, { model: "asc" }],
      select: { id: true, marka: true, model: true, aktif: true },
    }),
    prisma.aracModelKatalog.count({ where: { kilitli: true } }),
  ])

  return {
    markalar: gruplar.map((g) => ({ marka: g.marka, sayi: g._count._all })),
    elle,
    hazirSayi,
    elleSayi: elle.length,
  }
}
