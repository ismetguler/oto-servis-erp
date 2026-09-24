import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { aramaKosullari } from "@/lib/arama"
import { prisma } from "@/lib/prisma"

/**
 * KARA LİSTE — okuma tarafı.
 *
 * İki liste var: hâlâ kara listede olanlar (açık kayıtlar) ve geçmişte
 * konulup kaldırılanlar. İkisi de aynı tablodan okunuyor, ayrım
 * `kaldirmaTarihi` alanının dolu olup olmaması.
 */

export type KaraListeSatiri = {
  kayitId: number
  cariId: number
  kod: string
  unvan: string
  telefon: string | null
  bakiye: number
  neden: string
  alisTarihi: Date
  ekleyenKod: string | null
  kaldirmaTarihi: Date | null
  kaldirmaNedeni: string | null
  kaldiranKod: string | null
  acikKabulSayisi: number
}

const CARI_SECIMI = {
  select: { id: true, kod: true, unvan: true, telefon: true, gsm: true, bakiye: true },
} as const

async function satirlariKur(
  kayitlar: Array<{
    id: number
    cariId: number
    neden: string
    alisTarihi: Date
    ekleyenKod: string | null
    kaldirmaTarihi: Date | null
    kaldirmaNedeni: string | null
    kaldiranKod: string | null
    cari: {
      id: number
      kod: string
      unvan: string
      telefon: string | null
      gsm: string | null
      bakiye: unknown
    }
  }>
): Promise<KaraListeSatiri[]> {
  const cariIdler = [...new Set(kayitlar.map((k) => k.cariId))]

  // Açık onarım sayısı listede duruyor: kara listedeki bir carinin serviste
  // duran aracı varsa bu, ekranı açan kişinin ilk sorması gereken şey.
  const acikKabuller = cariIdler.length
    ? await prisma.kabul.groupBy({
        by: ["cariId"],
        where: {
          cariId: { in: cariIdler },
          silindi: false,
          durum: { notIn: ["TESLIM_EDILDI", "IPTAL"] },
        },
        _count: { _all: true },
      })
    : []
  const sayilar = new Map(acikKabuller.map((k) => [k.cariId, k._count._all]))

  return kayitlar.map((k) => ({
    kayitId: k.id,
    cariId: k.cariId,
    kod: k.cari.kod,
    unvan: k.cari.unvan,
    telefon: k.cari.gsm ?? k.cari.telefon,
    bakiye: Number(String(k.cari.bakiye)),
    neden: k.neden,
    alisTarihi: k.alisTarihi,
    ekleyenKod: k.ekleyenKod,
    kaldirmaTarihi: k.kaldirmaTarihi,
    kaldirmaNedeni: k.kaldirmaNedeni,
    kaldiranKod: k.kaldiranKod,
    acikKabulSayisi: sayilar.get(k.cariId) ?? 0,
  }))
}

/** Hâlâ kara listede olanlar. */
export async function acikKaraListeGetir(q = "") {
  const arama = q.trim()
  const kayitlar = await prisma.karaListeKaydi.findMany({
    where: {
      kaldirmaTarihi: null,
      cari: {
        silindi: false,
        ...(arama
          ? { OR: aramaKosullari<Prisma.CariWhereInput>(["unvan", "kod"], arama) }
          : {}),
      },
    },
    orderBy: { alisTarihi: "desc" },
    select: {
      id: true,
      cariId: true,
      neden: true,
      alisTarihi: true,
      ekleyenKod: true,
      kaldirmaTarihi: true,
      kaldirmaNedeni: true,
      kaldiranKod: true,
      cari: CARI_SECIMI,
    },
  })
  return satirlariKur(kayitlar)
}

/** Konulup kaldırılmış kayıtlar — "bu müşteri daha önce de kara listedeydi". */
export async function gecmisKaraListeGetir(q = "") {
  const arama = q.trim()
  const kayitlar = await prisma.karaListeKaydi.findMany({
    where: {
      NOT: { kaldirmaTarihi: null },
      cari: {
        silindi: false,
        ...(arama
          ? { OR: aramaKosullari<Prisma.CariWhereInput>(["unvan", "kod"], arama) }
          : {}),
      },
    },
    orderBy: { kaldirmaTarihi: "desc" },
    take: 200,
    select: {
      id: true,
      cariId: true,
      neden: true,
      alisTarihi: true,
      ekleyenKod: true,
      kaldirmaTarihi: true,
      kaldirmaNedeni: true,
      kaldiranKod: true,
      cari: CARI_SECIMI,
    },
  })
  return satirlariKur(kayitlar)
}

/** Cari kartındaki geçmiş bloğu — en yeni kayıt en üstte. */
export async function cariKaraListeGecmisi(cariId: number) {
  return prisma.karaListeKaydi.findMany({
    where: { cariId },
    orderBy: [{ alisTarihi: "desc" }, { id: "desc" }],
    select: {
      id: true,
      neden: true,
      alisTarihi: true,
      ekleyenKod: true,
      kaldirmaTarihi: true,
      kaldirmaNedeni: true,
      kaldiranKod: true,
    },
  })
}
