import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import type { LogIslem } from "@/generated/prisma/enums"
import { gunBasi, gunSonu } from "@/lib/bicim"
import { prisma } from "@/lib/prisma"

/**
 * İŞLEM KAYITLARI — ORTAK FİLTRE (ADIM 11.5)
 *
 * Ekran, dışa aktarma ve sayfa sayacı AYNI koşulu kullanır — Cari
 * listesindeki `cariListeKosulu` deseninin aynısı (bkz. HAFIZA 57).
 */
export type LogFiltreleri = {
  bas?: string
  bit?: string
  kullaniciId?: string
  tablo?: string
  islem?: string
}

/** Varsayılan aralık: son 7 gün (İsmet'in talimatı — 11.5 kapsamı). */
export function varsayilanLogAraligi() {
  const bugun = new Date()
  const yediGunOnce = new Date(bugun)
  yediGunOnce.setDate(bugun.getDate() - 6) // bugün dahil 7 gün
  const bicim = (g: Date) =>
    `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, "0")}-${String(g.getDate()).padStart(2, "0")}`
  return { bas: bicim(yediGunOnce), bit: bicim(bugun) }
}

export function logListeKosulu(f: LogFiltreleri): Prisma.IslemLogWhereInput {
  const bas = f.bas ? gunBasi(new Date(`${f.bas}T00:00:00`)) : undefined
  const bit = f.bit ? gunSonu(new Date(`${f.bit}T00:00:00`)) : undefined

  return {
    ...(bas || bit ? { tarih: { ...(bas ? { gte: bas } : {}), ...(bit ? { lte: bit } : {}) } } : {}),
    ...(f.kullaniciId ? { kullaniciId: Number(f.kullaniciId) } : {}),
    ...(f.tablo ? { tablo: f.tablo } : {}),
    ...(f.islem ? { islem: f.islem as LogIslem } : {}),
  }
}

/** Sayfa değiştirirken/dışa aktarırken mevcut filtreleri adres çubuğuna taşır. */
export function logFiltreSorgusu(f: LogFiltreleri): string {
  const p = new URLSearchParams()
  if (f.bas) p.set("bas", f.bas)
  if (f.bit) p.set("bit", f.bit)
  if (f.kullaniciId) p.set("kullaniciId", f.kullaniciId)
  if (f.tablo) p.set("tablo", f.tablo)
  if (f.islem) p.set("islem", f.islem)
  const metin = p.toString()
  return metin ? `?${metin}` : ""
}

/**
 * Son otomatik bakım bilgisi — `/ayar/log` üstündeki bilgi satırı için.
 *
 * Yeni tablo/alan AÇMADAN: bakım uçları kendi işlerini `islem_loglari`'na
 * logluyor — haftalık mail+budama (`/api/bakim/log-mail`, "haftalık log maili")
 * ya da elle çağrılan budama (`/api/bakim/log-budama`, "otomatik budama:") —
 * bunların en son olanını okuyoruz.
 */
export async function sonBudamaBilgisi() {
  return prisma.islemLog.findFirst({
    where: {
      tablo: "islem_loglari",
      OR: [
        { aciklama: { startsWith: "otomatik budama:" } },
        { aciklama: { startsWith: "haftalık log maili" } },
      ],
    },
    orderBy: { tarih: "desc" },
    select: { tarih: true, aciklama: true },
  })
}

/** Filtre dropdown'ları: kullanıcı listesi + logda GERÇEKTEN geçen tablo adları. */
export async function logFiltreSecenekleriGetir() {
  const [kullanicilar, tablolar] = await Promise.all([
    prisma.kullanici.findMany({
      orderBy: { ad: "asc" },
      select: { id: true, ad: true, soyad: true, kod: true },
    }),
    prisma.islemLog.findMany({
      where: { tablo: { not: null } },
      distinct: ["tablo"],
      select: { tablo: true },
      orderBy: { tablo: "asc" },
    }),
  ])

  return {
    kullanicilar: kullanicilar.map((k) => ({
      id: k.id,
      ad: `${[k.ad, k.soyad].filter(Boolean).join(" ")} (${k.kod})`,
    })),
    tablolar: tablolar.map((t) => t.tablo!).filter(Boolean),
  }
}
