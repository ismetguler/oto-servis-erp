import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { aramaKosullari } from "@/lib/arama"
import { prisma } from "@/lib/prisma"

/**
 * KABUL PARÇA ÇIKIŞI — okuma tarafı
 *
 * Depocu ekranı iki şey soruyor: "hangi kabul?" ve "hangi parça?".
 * İkisi de aramayla çözülüyor; ekranın tamamı klavyeyle kullanılabilsin
 * diye barkod okutulduğunda TEK kayıt dönmesi hedefleniyor (birebir kod /
 * barkod eşleşmesi önce denenir, bulunamazsa geniş arama yapılır).
 */

/** Parça çıkışı yapılabilecek kabuller — teslim edilmiş kart listeye girmez. */
export async function acikKabulleriGetir(q = "") {
  const arama = q.trim()

  const kosul: Prisma.KabulWhereInput = {
    silindi: false,
    durum: { in: ["ACIK", "BEKLEMEDE", "TAMAMLANDI"] },
    ...(arama
      ? {
          OR: [
            ...aramaKosullari<Prisma.KabulWhereInput>(
              ["kabulNo", "kabulOzelNo", "cari.unvan"],
              arama
            ),
            { arac: { plaka: { contains: arama.replace(/\s+/g, ""), mode: "insensitive" } } },
          ],
        }
      : {}),
  }

  const kayitlar = await prisma.kabul.findMany({
    where: kosul,
    orderBy: { girisTarihi: "desc" },
    take: 100,
    select: {
      id: true,
      kabulNo: true,
      durum: true,
      girisTarihi: true,
      parcaToplam: true,
      arac: { select: { id: true, plaka: true, marka: true, model: true } },
      cari: { select: { id: true, unvan: true } },
      _count: { select: { kalemler: true } },
    },
  })

  return kayitlar
}

/** Hızlı ekranın üst bilgisi — kart kapalıysa ekran salt okunur açılır. */
export async function cikisKabuluGetir(kabulId: number) {
  const k = await prisma.kabul.findUnique({
    where: { id: kabulId },
    select: {
      id: true,
      kabulNo: true,
      durum: true,
      silindi: true,
      girisTarihi: true,
      girisKm: true,
      kdvDahilGirilir: true,
      evrakKdvOrani: true,
      parcaToplam: true,
      genelToplam: true,
      arac: { select: { id: true, plaka: true, marka: true, model: true } },
      cari: { select: { id: true, unvan: true } },
    },
  })
  if (!k || k.silindi) return null

  return {
    ...k,
    evrakKdvOrani: Number(k.evrakKdvOrani.toString()),
    parcaToplam: Number(k.parcaToplam.toString()),
    genelToplam: Number(k.genelToplam.toString()),
  }
}

export type CikisKabulu = NonNullable<Awaited<ReturnType<typeof cikisKabuluGetir>>>

/** O kabule şu ana kadar çıkılan parçalar (işçilik satırları listeye girmez). */
export async function cikilanParcalariGetir(kabulId: number) {
  const kalemler = await prisma.kabulKalem.findMany({
    where: { kabulId, tur: "PARCA" },
    orderBy: { sira: "desc" },
    select: {
      id: true,
      sira: true,
      aciklama: true,
      birim: true,
      miktar: true,
      birimFiyat: true,
      kdvOrani: true,
      tutar: true,
      toplam: true,
      garantili: true,
      stokId: true,
      stok: { select: { kod: true, barkod: true, mevcutMiktar: true } },
    },
  })

  return kalemler.map((k) => ({
    id: k.id,
    sira: k.sira,
    aciklama: k.aciklama,
    birim: k.birim,
    miktar: Number(k.miktar.toString()),
    birimFiyat: Number(k.birimFiyat.toString()),
    kdvOrani: Number(k.kdvOrani.toString()),
    tutar: Number(k.tutar.toString()),
    toplam: Number(k.toplam.toString()),
    garantili: k.garantili,
    stokId: k.stokId,
    stokKodu: k.stok?.kod ?? null,
    barkod: k.stok?.barkod ?? null,
    stokta: k.stok ? Number(k.stok.mevcutMiktar.toString()) : null,
  }))
}

export type CikilanParca = Awaited<ReturnType<typeof cikilanParcalariGetir>>[number]

export type BulunanParca = {
  id: number
  kod: string
  ad: string
  barkod: string | null
  rafYeri: string | null
  birim: string
  fiyat: number
  kdvOrani: number
  stokta: number
}

const PARCA_ALANLARI = {
  id: true,
  kod: true,
  ad: true,
  barkod: true,
  rafYeri: true,
  birim: true,
  satisFiyat: true,
  kdvOrani: true,
  mevcutMiktar: true,
} as const

type HamParca = {
  id: number
  kod: string
  ad: string
  barkod: string | null
  rafYeri: string | null
  birim: string
  satisFiyat: Prisma.Decimal
  kdvOrani: Prisma.Decimal
  mevcutMiktar: Prisma.Decimal
}

const bicimle = (s: HamParca): BulunanParca => ({
  id: s.id,
  kod: s.kod,
  ad: s.ad,
  barkod: s.barkod,
  rafYeri: s.rafYeri,
  birim: s.birim,
  fiyat: Number(s.satisFiyat.toString()),
  kdvOrani: Number(s.kdvOrani.toString()),
  stokta: Number(s.mevcutMiktar.toString()),
})

/**
 * Barkod / stok kodu okuması.
 *
 * Barkod okuyucu alana yazıp Enter'a bastığında ekranın DURMAMASI gerekiyor:
 * bu yüzden önce tam eşleşme (barkod, kod, üretici/orijinal kod) aranır ve
 * tek kayıt bulunursa doğrudan seçilir. Tam eşleşme yoksa aynı metin isim
 * içinde de aranır ve kullanıcıya kısa bir liste sunulur.
 */
export async function parcaOku(metin: string): Promise<{
  tam: BulunanParca | null
  adaylar: BulunanParca[]
}> {
  const arama = metin.trim()
  if (arama.length < 2) return { tam: null, adaylar: [] }

  const tamEslesme = await prisma.stok.findMany({
    where: {
      silindi: false,
      aktif: true,
      OR: [
        { barkod: { equals: arama, mode: "insensitive" } },
        { kod: { equals: arama, mode: "insensitive" } },
        { orijinalKodu: { equals: arama, mode: "insensitive" } },
        { ureticiKodu: { equals: arama, mode: "insensitive" } },
      ],
    },
    take: 5,
    select: PARCA_ALANLARI,
  })

  if (tamEslesme.length === 1) return { tam: bicimle(tamEslesme[0]), adaylar: [] }
  if (tamEslesme.length > 1) {
    return { tam: null, adaylar: tamEslesme.map(bicimle) }
  }

  const adaylar = await prisma.stok.findMany({
    where: {
      silindi: false,
      aktif: true,
      OR: [
        { kod: { contains: arama, mode: "insensitive" } },
        { ad: { contains: arama, mode: "insensitive" } },
        { barkod: { contains: arama, mode: "insensitive" } },
        { orijinalKodu: { contains: arama, mode: "insensitive" } },
        { muadilNo: { contains: arama, mode: "insensitive" } },
      ],
    },
    orderBy: { ad: "asc" },
    take: 15,
    select: PARCA_ALANLARI,
  })

  return { tam: null, adaylar: adaylar.map(bicimle) }
}
