import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import type { OdemeSekli, TahsilatTur } from "@/generated/prisma/enums"
import { aramaKosullari } from "@/lib/arama"
import { gunBasi, gunSonu, sayi } from "@/lib/bicim"
import { prisma } from "@/lib/prisma"

/**
 * TAHSİLAT / ÖDEME — okuma tarafı
 *
 * Tek tablo iki ekranı besliyor (`tur` alanı yönü tutuyor): Selpar'da da
 * Tahsilat ve Tediye aynı fiş yapısının iki yüzü. Ayrı tablo yapılsaydı
 * cari ekstresi iki kaynaktan birleştirilmek zorunda kalırdı.
 */

export const TUR_ADI: Record<TahsilatTur, string> = {
  TAHSILAT: "Tahsilat",
  TEDIYE: "Ödeme",
}

export const ODEME_SEKLI_ADI: Record<OdemeSekli, string> = {
  NAKIT: "Nakit",
  KREDI_KARTI: "Kredi Kartı",
  HAVALE: "Havale / EFT",
  CEK: "Çek",
  SENET: "Senet",
  MAHSUP: "Mahsup",
}

export type TahsilatFiltreleri = {
  tur?: string
  odeme?: string
  kasa?: string
  cari?: string
  q?: string
  bas?: string
  bit?: string
}

/** Varsayılan aralık: içinde bulunulan ay — liste açılır açılmaz dolu gelsin. */
export function varsayilanAralik() {
  const bugun = new Date()
  const ilk = new Date(bugun.getFullYear(), bugun.getMonth(), 1)
  const bicim = (g: Date) =>
    `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, "0")}-${String(g.getDate()).padStart(2, "0")}`
  return { bas: bicim(ilk), bit: bicim(bugun) }
}

export function listeKosulu(f: TahsilatFiltreleri): Prisma.TahsilatWhereInput {
  const kosul: Prisma.TahsilatWhereInput = { silindi: false }

  if (f.tur === "TAHSILAT" || f.tur === "TEDIYE") kosul.tur = f.tur
  if (f.odeme && f.odeme !== "" && f.odeme !== "tumu") kosul.odemeSekli = f.odeme as OdemeSekli
  if (f.kasa && f.kasa !== "" && f.kasa !== "tumu") kosul.kasaId = Number(f.kasa)
  if (f.cari && f.cari !== "") kosul.cariId = Number(f.cari)

  if (f.bas || f.bit) {
    const aralik: Prisma.DateTimeFilter = {}
    if (f.bas) aralik.gte = gunBasi(new Date(f.bas))
    if (f.bit) aralik.lte = gunSonu(new Date(f.bit))
    kosul.tarih = aralik
  }

  const q = (f.q ?? "").trim()
  if (q) {
    kosul.OR = aramaKosullari<Prisma.TahsilatWhereInput>(
      ["fisNo", "aciklama", "cari.unvan", "cari.kod"],
      q
    )
  }

  return kosul
}

export function filtreSorgusu(f: TahsilatFiltreleri): string {
  const p = new URLSearchParams()
  for (const [anahtar, deger] of Object.entries(f)) {
    if (deger && deger !== "" && deger !== "tumu") p.set(anahtar, String(deger))
  }
  const metin = p.toString()
  return metin ? `?${metin}` : ""
}

export type TahsilatSatiri = {
  id: number
  fisNo: string
  tur: TahsilatTur
  tarih: Date
  tutar: number
  odemeSekli: OdemeSekli
  cariId: number
  cariKod: string
  cariUnvan: string
  kasaId: number | null
  kasaAd: string | null
  aciklama: string | null
}

export async function tahsilatlariGetir(f: TahsilatFiltreleri): Promise<TahsilatSatiri[]> {
  const kayitlar = await prisma.tahsilat.findMany({
    where: listeKosulu(f),
    orderBy: [{ tarih: "desc" }, { id: "desc" }],
    take: 1000,
    select: {
      id: true,
      fisNo: true,
      tur: true,
      tarih: true,
      tutar: true,
      odemeSekli: true,
      cariId: true,
      cari: { select: { kod: true, unvan: true } },
      kasaId: true,
      kasa: { select: { ad: true } },
      aciklama: true,
    },
  })

  return kayitlar.map((k) => ({
    id: k.id,
    fisNo: k.fisNo,
    tur: k.tur,
    tarih: k.tarih,
    tutar: sayi(k.tutar),
    odemeSekli: k.odemeSekli,
    cariId: k.cariId,
    cariKod: k.cari.kod,
    cariUnvan: k.cari.unvan,
    kasaId: k.kasaId,
    kasaAd: k.kasa?.ad ?? null,
    aciklama: k.aciklama,
  }))
}

export type TahsilatOzeti = {
  adet: number
  tahsilatToplam: number
  tediyeToplam: number
  net: number
}

export async function tahsilatOzeti(f: TahsilatFiltreleri): Promise<TahsilatOzeti> {
  const gruplar = await prisma.tahsilat.groupBy({
    by: ["tur"],
    where: listeKosulu(f),
    _sum: { tutar: true },
    _count: { _all: true },
  })

  const tahsilat = sayi(gruplar.find((g) => g.tur === "TAHSILAT")?._sum.tutar)
  const tediye = sayi(gruplar.find((g) => g.tur === "TEDIYE")?._sum.tutar)

  return {
    adet: gruplar.reduce((t, g) => t + g._count._all, 0),
    tahsilatToplam: tahsilat,
    tediyeToplam: tediye,
    net: tahsilat - tediye,
  }
}

export async function tahsilatGetir(id: number) {
  return prisma.tahsilat.findUnique({
    where: { id },
    include: {
      cari: { select: { id: true, kod: true, unvan: true, bakiye: true, karaListe: true, karaListeNedeni: true } },
      kasa: { select: { id: true, ad: true, tur: true } },
      hareketler: {
        where: { silindi: false },
        select: { id: true, tur: true, borc: true, alacak: true, tarih: true, aciklama: true },
      },
      kasaHareketleri: {
        where: { silindi: false },
        select: { id: true, kasaId: true, tur: true, tutar: true, kasa: { select: { ad: true } } },
      },
      /// Fişten doğan çek/senet (adım 6.3). Silinmişi de çekiliyor: fiş geri
      /// alındığında kâğıdın alanları buradan yeniden dolduruluyor.
      cekSenet: {
        select: {
          id: true,
          portfoyNo: true,
          tur: true,
          yon: true,
          durum: true,
          vadeTarihi: true,
          belgeNo: true,
          banka: true,
          borclu: true,
          tutar: true,
          silindi: true,
          tahsilKasa: { select: { id: true, ad: true } },
        },
      },
    },
  })
}

/** Cari kartından "tahsilat gir" ile gelindiğinde formu hazır doldurmak için. */
export async function hazirCariGetir(id: number | undefined) {
  if (!id || !Number.isInteger(id)) return undefined
  const cari = await prisma.cari.findFirst({
    where: { id, silindi: false },
    select: { id: true, kod: true, unvan: true, bakiye: true, karaListe: true, karaListeNedeni: true },
  })
  if (!cari) return undefined
  return { ...cari, bakiye: sayi(cari.bakiye) }
}

// ---------------------------------------------------------------------------
//  HIZLI TAHSİLAT (adım 6.2)
// ---------------------------------------------------------------------------

export type KabulTahsilatOzeti = {
  kabulId: number
  genelToplam: number
  /** Kabule bağlı fişlerin NET toplamı (tahsilat − varsa iade/tediye). */
  tahsilEdilen: number
  kalan: number
  fisAdedi: number
}

/**
 * Birden çok kabul kartının tahsilat özeti — liste ekranı satır başına ayrı
 * sorgu atmasın diye tek `groupBy` ile toplanıyor (50 satırlık sayfada 50 ek
 * sorgu demek olurdu).
 */
export async function kabulTahsilatOzetleri(
  kabuller: readonly { id: number; genelToplam: Prisma.Decimal | number }[]
): Promise<Map<number, KabulTahsilatOzeti>> {
  const sonuc = new Map<number, KabulTahsilatOzeti>()
  if (kabuller.length === 0) return sonuc

  const gruplar = await prisma.tahsilat.groupBy({
    by: ["kabulId", "tur"],
    where: { silindi: false, kabulId: { in: kabuller.map((k) => k.id) } },
    _sum: { tutar: true },
    _count: { _all: true },
  })

  for (const kabul of kabuller) {
    const kendi = gruplar.filter((g) => g.kabulId === kabul.id)
    const topla = (tur: TahsilatTur) =>
      sayi(kendi.find((g) => g.tur === tur)?._sum.tutar ?? 0)

    const genelToplam = sayi(kabul.genelToplam)
    const tahsilEdilen = topla("TAHSILAT") - topla("TEDIYE")

    sonuc.set(kabul.id, {
      kabulId: kabul.id,
      genelToplam,
      tahsilEdilen,
      kalan: genelToplam - tahsilEdilen,
      fisAdedi: kendi.reduce((t, g) => t + g._count._all, 0),
    })
  }

  return sonuc
}

/** Tek kabul kartı için özet — kabul detay sayfası kullanıyor. */
export async function kabulTahsilatOzeti(kabulId: number): Promise<KabulTahsilatOzeti> {
  const kabul = await prisma.kabul.findUnique({
    where: { id: kabulId },
    select: { id: true, genelToplam: true },
  })
  const bos = { kabulId, genelToplam: 0, tahsilEdilen: 0, kalan: 0, fisAdedi: 0 }
  if (!kabul) return bos
  return (await kabulTahsilatOzetleri([kabul])).get(kabulId) ?? bos
}

/** Kabul kartında listelenen fişler (kart üstünden girilenler dâhil). */
export async function kabulTahsilatlari(kabulId: number) {
  const kayitlar = await prisma.tahsilat.findMany({
    where: { kabulId, silindi: false },
    orderBy: [{ tarih: "desc" }, { id: "desc" }],
    select: {
      id: true,
      fisNo: true,
      tur: true,
      tarih: true,
      tutar: true,
      odemeSekli: true,
      kasa: { select: { ad: true } },
      aciklama: true,
    },
  })
  return kayitlar.map((k) => ({ ...k, tutar: sayi(k.tutar), kasaAd: k.kasa?.ad ?? null }))
}
