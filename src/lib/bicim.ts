import type { Prisma } from "@/generated/prisma/client"

/**
 * BİÇİMLENDİRME
 * Tutar, tarih ve sayıların ekranda TEK bir şekilde görünmesi için tek yer.
 * (Bir yerde "1.250,00 TL", başka yerde "1250 TL" görünmesin.)
 */

type Sayisal = Prisma.Decimal | number | string | null | undefined

/** Prisma'nın Decimal tipini güvenle JavaScript sayısına çevirir. */
export function sayi(deger: Sayisal): number {
  if (deger === null || deger === undefined) return 0
  if (typeof deger === "number") return deger
  return Number(deger.toString())
}

const paraBicimi = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** 1250.5  ->  "1.250,50 ₺" */
export function para(deger: Sayisal, simge = true): string {
  const metin = paraBicimi.format(sayi(deger))
  return simge ? `${metin} ₺` : metin
}

/** Miktar: gereksiz sıfırları atar. 2.000 -> "2", 1.500 -> "1,5" */
export function miktar(deger: Sayisal): string {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 }).format(
    sayi(deger)
  )
}

/** 0.2 -> "%20" (oran zaten 20 olarak tutuluyorsa doğrudan yazar) */
export function yuzde(deger: Sayisal): string {
  return `%${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(sayi(deger))}`
}

/** 24.08.2026 */
export function tarih(deger: Date | string | null | undefined): string {
  if (!deger) return "—"
  const d = deger instanceof Date ? deger : new Date(deger)
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

/** 24.08.2026 18:42 */
export function tarihSaat(deger: Date | string | null | undefined): string {
  if (!deger) return "—"
  const d = deger instanceof Date ? deger : new Date(deger)
  return `${tarih(d)} ${d.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`
}

/** Plakayı okunur hâle getirir: "38abc123" -> "38 ABC 123" */
export function plaka(deger: string | null | undefined): string {
  if (!deger) return "—"
  const temiz = deger.toLocaleUpperCase("tr-TR").replace(/\s+/g, "")
  const parcalar = temiz.match(/^(\d{2})([A-ZÇĞİÖŞÜ]{1,3})(\d{1,5})$/)
  return parcalar ? `${parcalar[1]} ${parcalar[2]} ${parcalar[3]}` : temiz
}

/** Bugünün 00:00'ı — "bugün açılan kabuller" gibi sorgular için. */
export function gunBasi(gun = new Date()): Date {
  const d = new Date(gun)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Bugünün 23:59:59'u. */
export function gunSonu(gun = new Date()): Date {
  const d = new Date(gun)
  d.setHours(23, 59, 59, 999)
  return d
}
