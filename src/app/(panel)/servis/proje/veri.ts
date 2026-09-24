import "server-only"

import type { ProjeSatiri } from "@/components/proje/proje-yonetimi"
import type { Prisma } from "@/generated/prisma/client"
import { aramaKosullari } from "@/lib/arama"
import { prisma } from "@/lib/prisma"

/**
 * PROJE — okuma tarafı.
 *
 * Proje kabul/araç kartında METİN olarak tutuluyor (Selpar mimarisi), bu
 * yüzden kullanım sayıları ada göre gruplanarak bulunuyor. Tanım listesinde
 * olmayan ama kartlarda geçen adlar da raporda görünür — eski kayıtlar
 * kaybolmasın diye.
 */

export async function projeleriGetir(): Promise<ProjeSatiri[]> {
  const [tanimlar, kabulGruplari, aracGruplari] = await Promise.all([
    prisma.tanim.findMany({
      where: { tur: "PROJE" },
      orderBy: [{ sira: "asc" }, { ad: "asc" }],
      select: { id: true, kod: true, ad: true, sira: true, aktif: true },
    }),
    prisma.kabul.groupBy({
      by: ["projesi"],
      where: { silindi: false, projesi: { not: null } },
      _count: { _all: true },
      _sum: { genelToplam: true },
    }),
    prisma.arac.groupBy({
      by: ["projesi"],
      where: { silindi: false, projesi: { not: null } },
      _count: { _all: true },
    }),
  ])

  const kabulHaritasi = new Map(
    kabulGruplari.map((g) => [
      g.projesi ?? "",
      { adet: g._count._all, tutar: Number((g._sum.genelToplam ?? 0).toString()) },
    ])
  )
  const aracHaritasi = new Map(aracGruplari.map((g) => [g.projesi ?? "", g._count._all]))

  return tanimlar.map((t) => ({
    ...t,
    kabulSayisi: kabulHaritasi.get(t.ad)?.adet ?? 0,
    aracSayisi: aracHaritasi.get(t.ad) ?? 0,
    tutar: kabulHaritasi.get(t.ad)?.tutar ?? 0,
  }))
}

export type ProjeRaporFiltreleri = {
  proje?: string
  q?: string
  durum?: string
  bas?: string
  bit?: string
}

/** Rapor ekranı ve CSV aynı koşulu kullansın diye filtre tek yerde kuruluyor. */
export function projeRaporKosulu({
  proje = "",
  q = "",
  durum = "",
  bas = "",
  bit = "",
}: ProjeRaporFiltreleri): Prisma.KabulWhereInput {
  const arama = q.trim()
  const baslangic = bas ? new Date(`${bas}T00:00:00`) : null
  const bitis = bit ? new Date(`${bit}T23:59:59.999`) : null

  return {
    silindi: false,
    // "Projesiz" seçeneği: proje alanı boş bırakılmış kartları ayıklamak için.
    ...(proje === "__yok__"
      ? { OR: [{ projesi: null }, { projesi: "" }] }
      : proje
        ? { projesi: proje }
        : { NOT: [{ projesi: null }, { projesi: "" }] }),
    ...(durum ? { durum: durum as Prisma.EnumKabulDurumFilter["equals"] } : {}),
    ...(baslangic || bitis
      ? {
          girisTarihi: {
            ...(baslangic ? { gte: baslangic } : {}),
            ...(bitis ? { lte: bitis } : {}),
          },
        }
      : {}),
    ...(arama
      ? {
          OR: aramaKosullari<Prisma.KabulWhereInput>(
            ["kabulNo", "arac.plaka", "cari.unvan", "filoSirketi"],
            arama
          ),
        }
      : {}),
  }
}

export function projeRaporSorgusu(f: ProjeRaporFiltreleri): string {
  const p = new URLSearchParams()
  if (f.proje) p.set("proje", f.proje)
  if (f.q) p.set("q", f.q)
  if (f.durum) p.set("durum", f.durum)
  if (f.bas) p.set("bas", f.bas)
  if (f.bit) p.set("bit", f.bit)
  const metin = p.toString()
  return metin ? `?${metin}` : ""
}

export type ProjeRaporSatiri = {
  id: number
  kabulNo: string
  girisTarihi: Date
  teslimTarihi: Date | null
  durum: string
  plaka: string
  marka: string | null
  model: string | null
  musteri: string
  filoSirketi: string | null
  parcaToplam: number
  iscilikToplam: number
  genelToplam: number
  faturaKesildi: boolean
  proje: string
}

export type ProjeGrubu = {
  proje: string
  satirlar: ProjeRaporSatiri[]
  kabulSayisi: number
  aracSayisi: number
  parcaToplam: number
  iscilikToplam: number
  genelToplam: number
  faturasizToplam: number
}

/** Rapor kayıtlarını okur ve proje bazında gruplar (ekran + CSV ortak). */
export async function projeRaporVerisi(f: ProjeRaporFiltreleri): Promise<ProjeGrubu[]> {
  const kayitlar = await prisma.kabul.findMany({
    where: projeRaporKosulu(f),
    orderBy: [{ girisTarihi: "desc" }],
    select: {
      id: true,
      kabulNo: true,
      girisTarihi: true,
      teslimTarihi: true,
      durum: true,
      projesi: true,
      filoSirketi: true,
      parcaToplam: true,
      iscilikToplam: true,
      genelToplam: true,
      faturaKesildi: true,
      arac: { select: { plaka: true, marka: true, model: true } },
      cari: { select: { unvan: true } },
    },
  })

  const gruplar = new Map<string, ProjeGrubu>()

  for (const k of kayitlar) {
    const proje = k.projesi?.trim() || "— Proje girilmemiş —"
    const satir: ProjeRaporSatiri = {
      id: k.id,
      kabulNo: k.kabulNo,
      girisTarihi: k.girisTarihi,
      teslimTarihi: k.teslimTarihi,
      durum: k.durum,
      plaka: k.arac.plaka,
      marka: k.arac.marka,
      model: k.arac.model,
      musteri: k.cari.unvan,
      filoSirketi: k.filoSirketi,
      parcaToplam: Number(k.parcaToplam.toString()),
      iscilikToplam: Number(k.iscilikToplam.toString()),
      genelToplam: Number(k.genelToplam.toString()),
      faturaKesildi: k.faturaKesildi,
      proje,
    }

    const grup = gruplar.get(proje) ?? {
      proje,
      satirlar: [],
      kabulSayisi: 0,
      aracSayisi: 0,
      parcaToplam: 0,
      iscilikToplam: 0,
      genelToplam: 0,
      faturasizToplam: 0,
    }

    grup.satirlar.push(satir)
    grup.kabulSayisi += 1
    grup.parcaToplam += satir.parcaToplam
    grup.iscilikToplam += satir.iscilikToplam
    grup.genelToplam += satir.genelToplam
    if (!satir.faturaKesildi) grup.faturasizToplam += satir.genelToplam
    gruplar.set(proje, grup)
  }

  // Araç adedi tekil plakadan sayılıyor: aynı araç projede birden çok kez
  // işlem görebiliyor, "kaç araca hizmet verdik" sorusu kabul adedinden farklı.
  for (const grup of gruplar.values()) {
    grup.aracSayisi = new Set(grup.satirlar.map((s) => s.plaka)).size
  }

  // Projesi girilmemiş grup en altta: eksik doldurulmuş kayıtlar, raporun
  // asıl konusu olan gerçek projelerin arasına karışmasın.
  return [...gruplar.values()].sort((a, b) => {
    const aBos = a.proje.startsWith("—")
    const bBos = b.proje.startsWith("—")
    if (aBos !== bBos) return aBos ? 1 : -1
    return b.genelToplam - a.genelToplam
  })
}

/** Filtre kutusunu besler: tanımlı projeler + kartlarda geçen adlar. */
export async function raporProjeSecenekleri(): Promise<string[]> {
  const [tanimlar, gruplar] = await Promise.all([
    prisma.tanim.findMany({
      where: { tur: "PROJE" },
      orderBy: [{ sira: "asc" }, { ad: "asc" }],
      select: { ad: true },
    }),
    prisma.kabul.groupBy({
      by: ["projesi"],
      where: { silindi: false, projesi: { not: null } },
    }),
  ])

  const adlar = new Set<string>()
  for (const t of tanimlar) adlar.add(t.ad)
  for (const g of gruplar) if (g.projesi?.trim()) adlar.add(g.projesi.trim())

  return [...adlar].sort((a, b) => a.localeCompare(b, "tr"))
}
