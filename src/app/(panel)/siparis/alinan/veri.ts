import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { katalogAra } from "@/app/(panel)/servis/kabul/veri"
import { aramaKosullari } from "@/lib/arama"
import { prisma } from "@/lib/prisma"

/**
 * ALINAN SİPARİŞ — okuma yardımcıları
 *
 * Kalem satırındaki "stok kartından seçim" satış faturasındaki gibi kabul
 * modülünün `katalogAra`sını (satış fiyatını öneren) yeniden kullanıyor —
 * alınan sipariş müşteriye satılacağı için alış fiyatı değil, satış fiyatı
 * doğru.
 */
export { katalogAra }

/** Sipariş formunda müşteri seçimi — personel hariç tüm cariler. */
export async function siparisCarileriGetir() {
  const cariler = await prisma.cari.findMany({
    where: { silindi: false, turu: { not: "PERSONEL" } },
    orderBy: { unvan: "asc" },
    select: { id: true, kod: true, unvan: true, bakiye: true },
  })
  return cariler.map((c) => ({ ...c, bakiye: Number(c.bakiye.toString()) }))
}

export type SiparisCarisi = Awaited<ReturnType<typeof siparisCarileriGetir>>[number]

/** Alınan sipariş listesi — filtre: cari/no, tarih aralığı, durum. */
export async function alinanSiparisleriGetir(f: {
  q?: string
  durum?: string
  bas?: string
  bit?: string
}) {
  return prisma.siparis.findMany({
    where: {
      silindi: false,
      tip: "ALINAN",
      ...(f.durum
        ? { durum: f.durum as "TASLAK" | "ONAYLANDI" | "KISMI_SEVK" | "TAMAMLANDI" | "IPTAL" }
        : {}),
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
            OR: aramaKosullari<Prisma.SiparisWhereInput>(["siparisNo", "cari.unvan"], f.q),
          }
        : {}),
    },
    orderBy: { tarih: "desc" },
    include: { cari: { select: { unvan: true, kod: true } }, kalemler: { select: { miktar: true, sevkMiktar: true } } },
  })
}

/** Sipariş kartı + kalemleri (detay ekranı). */
export async function siparisDetayiGetir(id: number) {
  return prisma.siparis.findUnique({
    where: { id },
    include: {
      cari: { select: { id: true, kod: true, unvan: true, bakiye: true } },
      kalemler: { orderBy: { sira: "asc" } },
    },
  })
}
