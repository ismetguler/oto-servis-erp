import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import type { CekSenetDurum, CekSenetTur, CekSenetYon, OnayDurum } from "@/generated/prisma/enums"
import { aramaKosullari } from "@/lib/arama"
import { gunBasi, gunSonu, sayi } from "@/lib/bicim"
import { prisma } from "@/lib/prisma"

/**
 * ÇEK / SENET — okuma tarafı ve iş kuralları
 *
 * Portföydeki kâğıt henüz para değildir: kasaya ancak tahsil/ödeme anında
 * dokunur. Cari bakiyesine ise onaylandığı anda dokunur — bu yüzden bekleyen
 * kâğıt hiçbir toplamı bozmaz.
 */

export const DURUM_ADI: Record<CekSenetDurum, string> = {
  PORTFOYDE: "Portföyde",
  TAHSILDE: "Tahsilde",
  TAHSIL_EDILDI: "Tahsil edildi",
  ODENDI: "Ödendi",
  KARSILIKSIZ: "Karşılıksız",
  CIRO_EDILDI: "Ciro edildi",
  IADE_EDILDI: "İade edildi",
}

export const ONAY_ADI: Record<OnayDurum, string> = {
  BEKLIYOR: "Onay bekliyor",
  ONAYLANDI: "Onaylandı",
  REDDEDILDI: "Reddedildi",
}

export const TUR_ADI: Record<CekSenetTur, string> = { CEK: "Çek", SENET: "Senet" }
export const YON_ADI: Record<CekSenetYon, string> = { ALINAN: "Alınan", VERILEN: "Verilen" }

/** Kâğıdın "kapandığı" durumlar — vade takibinden düşerler. */
export const KAPALI_DURUMLAR: CekSenetDurum[] = [
  "TAHSIL_EDILDI",
  "ODENDI",
  "CIRO_EDILDI",
  "IADE_EDILDI",
]

/**
 * İzin verilen durum geçişleri. Yön bazlı, çünkü alınan kâğıt "tahsil edilir",
 * verilen kâğıt "ödenir"; ikisi tek listede tutulsaydı verilen çek de
 * ciro edilebilir görünürdü.
 */
export const GECISLER: Record<CekSenetYon, Partial<Record<CekSenetDurum, CekSenetDurum[]>>> = {
  ALINAN: {
    PORTFOYDE: ["TAHSILDE", "TAHSIL_EDILDI", "CIRO_EDILDI", "IADE_EDILDI", "KARSILIKSIZ"],
    TAHSILDE: ["TAHSIL_EDILDI", "KARSILIKSIZ", "PORTFOYDE"],
    KARSILIKSIZ: ["PORTFOYDE", "TAHSIL_EDILDI", "IADE_EDILDI"],
    TAHSIL_EDILDI: [],
    CIRO_EDILDI: [],
    IADE_EDILDI: [],
    ODENDI: [],
  },
  VERILEN: {
    PORTFOYDE: ["ODENDI", "KARSILIKSIZ", "IADE_EDILDI"],
    KARSILIKSIZ: ["PORTFOYDE", "ODENDI"],
    ODENDI: [],
    TAHSILDE: [],
    TAHSIL_EDILDI: [],
    CIRO_EDILDI: [],
    IADE_EDILDI: [],
  },
}

/** Kasaya para giren/çıkan durumlar; bu geçişlerde kasa seçimi zorunlu. */
export function kasaGerektirir(yon: CekSenetYon, durum: CekSenetDurum): boolean {
  return (yon === "ALINAN" && durum === "TAHSIL_EDILDI") || (yon === "VERILEN" && durum === "ODENDI")
}

export type CekSenetFiltreleri = {
  yon?: string
  tur?: string
  durum?: string
  onay?: string
  vade?: string
  q?: string
  bas?: string
  bit?: string
  cari?: string
}

export function listeKosulu(f: CekSenetFiltreleri): Prisma.CekSenetWhereInput {
  const kosul: Prisma.CekSenetWhereInput = { silindi: false }

  if (f.yon === "ALINAN" || f.yon === "VERILEN") kosul.yon = f.yon
  if (f.tur === "CEK" || f.tur === "SENET") kosul.tur = f.tur
  if (f.cari && f.cari !== "") kosul.cariId = Number(f.cari)

  if (f.durum === "acik") kosul.durum = { notIn: KAPALI_DURUMLAR }
  else if (f.durum && f.durum !== "" && f.durum !== "tumu") {
    kosul.durum = f.durum as CekSenetDurum
  }

  if (f.onay && f.onay !== "" && f.onay !== "tumu") kosul.onayDurumu = f.onay as OnayDurum

  const bugun = new Date()
  if (f.vade === "gecen") {
    kosul.vadeTarihi = { lt: gunBasi(bugun) }
    kosul.durum = { notIn: KAPALI_DURUMLAR }
  } else if (f.vade === "bugun") {
    kosul.vadeTarihi = { gte: gunBasi(bugun), lte: gunSonu(bugun) }
  } else if (f.vade === "7" || f.vade === "15" || f.vade === "30") {
    const bitis = new Date(bugun)
    bitis.setDate(bitis.getDate() + Number(f.vade))
    kosul.vadeTarihi = { gte: gunBasi(bugun), lte: gunSonu(bitis) }
    kosul.durum = { notIn: KAPALI_DURUMLAR }
  } else if (f.bas || f.bit) {
    const aralik: Prisma.DateTimeFilter = {}
    if (f.bas) aralik.gte = gunBasi(new Date(f.bas))
    if (f.bit) aralik.lte = gunSonu(new Date(f.bit))
    kosul.vadeTarihi = aralik
  }

  const q = (f.q ?? "").trim()
  if (q) {
    kosul.OR = aramaKosullari<Prisma.CekSenetWhereInput>(
      ["portfoyNo", "belgeNo", "borclu", "banka", "aciklama", "cari.unvan"],
      q
    )
  }

  return kosul
}

export function filtreSorgusu(f: CekSenetFiltreleri): string {
  const p = new URLSearchParams()
  for (const [anahtar, deger] of Object.entries(f)) {
    if (deger && deger !== "" && deger !== "tumu") p.set(anahtar, String(deger))
  }
  const metin = p.toString()
  return metin ? `?${metin}` : ""
}

export type CekSenetSatiri = {
  id: number
  portfoyNo: string
  tur: CekSenetTur
  yon: CekSenetYon
  cariId: number | null
  cariUnvan: string | null
  tutar: number
  paraBirimi: string
  vadeTarihi: Date
  borclu: string | null
  banka: string | null
  belgeNo: string | null
  durum: CekSenetDurum
  onayDurumu: OnayDurum
  /** Vadeye kalan gün — eksi ise vadesi geçmiş. Kapalı kâğıtta null. */
  kalanGun: number | null
}

export async function cekSenetleriGetir(f: CekSenetFiltreleri): Promise<CekSenetSatiri[]> {
  const kayitlar = await prisma.cekSenet.findMany({
    where: listeKosulu(f),
    orderBy: [{ vadeTarihi: "asc" }, { id: "asc" }],
    take: 1000,
    select: {
      id: true,
      portfoyNo: true,
      tur: true,
      yon: true,
      cariId: true,
      cari: { select: { unvan: true } },
      tutar: true,
      paraBirimi: true,
      vadeTarihi: true,
      borclu: true,
      banka: true,
      belgeNo: true,
      durum: true,
      onayDurumu: true,
    },
  })

  const bugun = gunBasi()
  return kayitlar.map((k) => ({
    id: k.id,
    portfoyNo: k.portfoyNo,
    tur: k.tur,
    yon: k.yon,
    cariId: k.cariId,
    cariUnvan: k.cari?.unvan ?? null,
    tutar: sayi(k.tutar),
    paraBirimi: k.paraBirimi,
    vadeTarihi: k.vadeTarihi,
    borclu: k.borclu,
    banka: k.banka,
    belgeNo: k.belgeNo,
    durum: k.durum,
    onayDurumu: k.onayDurumu,
    kalanGun: KAPALI_DURUMLAR.includes(k.durum)
      ? null
      : Math.round((gunBasi(k.vadeTarihi).getTime() - bugun.getTime()) / 86_400_000),
  }))
}

export type CekSenetOzeti = {
  adet: number
  toplam: number
  alinanToplam: number
  verilenToplam: number
  vadesiGecen: number
  vadesiGecenTutar: number
  onayBekleyen: number
}

export async function cekSenetOzeti(f: CekSenetFiltreleri): Promise<CekSenetOzeti> {
  const kosul = listeKosulu(f)

  const [gruplar, gecen, bekleyen] = await Promise.all([
    prisma.cekSenet.groupBy({
      by: ["yon"],
      where: kosul,
      _sum: { tutar: true },
      _count: { _all: true },
    }),
    prisma.cekSenet.aggregate({
      where: {
        ...kosul,
        vadeTarihi: { lt: gunBasi() },
        durum: { notIn: KAPALI_DURUMLAR },
      },
      _sum: { tutar: true },
      _count: { _all: true },
    }),
    prisma.cekSenet.count({ where: { ...kosul, onayDurumu: "BEKLIYOR" } }),
  ])

  const alinan = gruplar.find((g) => g.yon === "ALINAN")
  const verilen = gruplar.find((g) => g.yon === "VERILEN")

  return {
    adet: gruplar.reduce((t, g) => t + g._count._all, 0),
    toplam: gruplar.reduce((t, g) => t + sayi(g._sum.tutar), 0),
    alinanToplam: sayi(alinan?._sum.tutar),
    verilenToplam: sayi(verilen?._sum.tutar),
    vadesiGecen: gecen._count._all,
    vadesiGecenTutar: sayi(gecen._sum.tutar),
    onayBekleyen: bekleyen,
  }
}

export async function cekSenetGetir(id: number) {
  return prisma.cekSenet.findUnique({
    where: { id },
    include: {
      cari: { select: { id: true, kod: true, unvan: true, bakiye: true } },
      ciroCari: { select: { id: true, unvan: true } },
      tahsilKasa: { select: { id: true, ad: true } },
      hareketler: { orderBy: [{ tarih: "desc" }, { id: "desc" }] },
      kasaHareketleri: {
        where: { silindi: false },
        select: { id: true, kasaId: true, tutar: true, tur: true, kasa: { select: { ad: true } } },
      },
    },
  })
}

/** Onay İşlemleri ekranı — bekleyen kâğıtlar, en eski vade üstte. */
export async function onayBekleyenler() {
  const kayitlar = await prisma.cekSenet.findMany({
    where: { silindi: false, onayDurumu: "BEKLIYOR" },
    orderBy: [{ vadeTarihi: "asc" }, { id: "asc" }],
    select: {
      id: true,
      portfoyNo: true,
      tur: true,
      yon: true,
      tutar: true,
      vadeTarihi: true,
      borclu: true,
      banka: true,
      belgeNo: true,
      aciklama: true,
      olusturmaTarihi: true,
      cari: { select: { id: true, unvan: true } },
    },
  })
  return kayitlar.map((k) => ({ ...k, tutar: sayi(k.tutar) }))
}
