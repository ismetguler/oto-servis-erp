import "server-only"

import type { PlasiyerSatiri } from "@/components/cari/plasiyer-yonetimi"
import { prisma } from "@/lib/prisma"

/**
 * Yönetim ekranı, listedeki her satırın KAÇ CARİDE kullanıldığını da gösterir.
 * Sebep: silinebilir mi, pasife alınırsa kim etkilenir sorusunun cevabı
 * olmadan bu ekranda hiçbir karar verilemiyor.
 */

export async function yonetimPlasiyerleriGetir(): Promise<PlasiyerSatiri[]> {
  const [personeller, gruplar] = await Promise.all([
    prisma.cari.findMany({
      where: { turu: "PERSONEL", silindi: false },
      orderBy: { unvan: "asc" },
      select: {
        id: true,
        kod: true,
        unvan: true,
        gsm: true,
        email: true,
        aktif: true,
      },
    }),
    prisma.cari.groupBy({
      by: ["plasiyerId"],
      where: { silindi: false, plasiyerId: { not: null } },
      _count: { _all: true },
    }),
  ])

  const sayilar = new Map(gruplar.map((g) => [g.plasiyerId ?? 0, g._count._all]))
  return personeller.map((p) => ({
    id: p.id,
    kod: p.kod,
    unvan: p.unvan,
    gsm: p.gsm,
    email: p.email,
    aktif: p.aktif,
    cariSayisi: sayilar.get(p.id) ?? 0,
  }))
}
