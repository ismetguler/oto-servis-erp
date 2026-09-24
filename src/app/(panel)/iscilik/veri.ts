import "server-only"

import type { IscilikBaslangic } from "@/components/iscilik/iscilik-formu"
import type { Prisma } from "@/generated/prisma/client"
import { aramaKosullari } from "@/lib/arama"
import { prisma } from "@/lib/prisma"

/**
 * İşçilik kaydını forma uygun hâle getirir.
 * Decimal alanlar string'e çevriliyor: Prisma Decimal nesnesi client
 * bileşenine serialize edilemez, Number'a çevirmek de kuruş kaybı riski taşır.
 */
export async function iscilikFormVerisi(id: number): Promise<IscilikBaslangic | null> {
  const i = await prisma.iscilik.findUnique({ where: { id } })
  if (!i || i.silindi) return null

  return {
    id: i.id,
    kod: i.kod,
    ad: i.ad,
    bolumId: i.bolumId,
    sure: i.sure.toString(),
    fiyat: i.fiyat.toString(),
    kdvOrani: i.kdvOrani.toString(),
    aciklama: i.aciklama,
    aktif: i.aktif,
  }
}

/** İşçilik bölümleri — hem formun dropdown'ını hem bölüm ekranını besler. */
export function iscilikBolumleriGetir(sadeceAktif = true) {
  return prisma.tanim.findMany({
    where: { tur: "ISCILIK_BOLUMU", ...(sadeceAktif ? { aktif: true } : {}) },
    orderBy: [{ sira: "asc" }, { ad: "asc" }],
    select: { id: true, kod: true, ad: true, sira: true, aktif: true },
  })
}

export type IscilikFiltreleri = {
  q?: string
  bolum?: string
  durum?: string
}

/** Ekran, sayaç ve CSV aynı koşulu kullansın diye filtre tek yerde kuruluyor. */
export function iscilikListeKosulu({
  q = "",
  bolum = "",
  durum = "aktif",
}: IscilikFiltreleri): Prisma.IscilikWhereInput {
  const arama = q.trim()
  const bolumId = Number(bolum)

  return {
    silindi: durum === "silinen",
    ...(durum === "aktif" ? { aktif: true } : {}),
    ...(durum === "pasif" ? { aktif: false } : {}),
    ...(Number.isInteger(bolumId) && bolumId > 0 ? { bolumId } : {}),
    ...(arama
      ? {
          OR: aramaKosullari<Prisma.IscilikWhereInput>(
            ["kod", "ad", "aciklama"],
            arama
          ),
        }
      : {}),
  }
}

export function iscilikFiltreSorgusu(f: IscilikFiltreleri): string {
  const p = new URLSearchParams()
  if (f.q) p.set("q", f.q)
  if (f.bolum) p.set("bolum", f.bolum)
  if (f.durum && f.durum !== "aktif") p.set("durum", f.durum)
  const metin = p.toString()
  return metin ? `?${metin}` : ""
}
