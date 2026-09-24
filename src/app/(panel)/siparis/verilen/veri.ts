import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { katalogAraAlis } from "@/app/(panel)/evrak/alis/veri"
import { siparisDetayiGetir } from "../alinan/veri"
import { aramaKosullari } from "@/lib/arama"
import { prisma } from "@/lib/prisma"

/**
 * VERİLEN SİPARİŞ — okuma yardımcıları
 *
 * `siparisDetayiGetir` tipe göre filtre yapmıyor (yalnız `id`) — alınan
 * modülünden yeniden kullanıldı, `tip !== "VERILEN"` kontrolü sayfa
 * seviyesinde (`notFound()`). Kalem satırındaki "stok kartından seçim" ise
 * alınan siparişten FARKLI: tedarikçiye verildiği için satış değil ALIŞ
 * fiyatı öneriliyor — alış faturasındaki `katalogAraAlis` yeniden kullanıldı.
 */
export { siparisDetayiGetir }
export const katalogAra = katalogAraAlis

/** Sipariş formunda tedarikçi seçimi — personel hariç tüm cariler. */
export async function siparisCarileriGetir() {
  const cariler = await prisma.cari.findMany({
    where: { silindi: false, turu: { not: "PERSONEL" } },
    orderBy: { unvan: "asc" },
    select: { id: true, kod: true, unvan: true, bakiye: true },
  })
  return cariler.map((c) => ({ ...c, bakiye: Number(c.bakiye.toString()) }))
}

export type SiparisCarisi = Awaited<ReturnType<typeof siparisCarileriGetir>>[number]

/** Verilen sipariş listesi — filtre: cari/no, tarih aralığı, durum. */
export async function verilenSiparisleriGetir(f: {
  q?: string
  durum?: string
  bas?: string
  bit?: string
}) {
  return prisma.siparis.findMany({
    where: {
      silindi: false,
      tip: "VERILEN",
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
