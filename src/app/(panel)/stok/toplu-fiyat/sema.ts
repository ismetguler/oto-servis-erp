import { z } from "zod"

import { metniSayiyaCevir } from "@/lib/sayi"

/** Güncellenebilecek fiyat alanları — Stok modelindeki fiyat kolonları. */
export const FIYAT_ALANLARI = {
  satisFiyat: "Satış Fiyatı",
  alisFiyat: "Alış Fiyatı",
} as const

export type FiyatAlani = keyof typeof FIYAT_ALANLARI

const fiyatAlaniSemasi = z.enum(
  Object.keys(FIYAT_ALANLARI) as [FiyatAlani, ...FiyatAlani[]]
)

/**
 * Toplu fiyat güncelleme formu.
 * `deger` metin olarak gelir (virgüllü giriş) — `metniSayiyaCevir` ile sayıya
 * çevrilip 0'dan büyük olması zorunlu tutulur (negatif zam anlamı `yon` ile
 * kuruluyor, `deger`in kendisi hep pozitif).
 */
export const topluFiyatSemasi = z
  .object({
    alan: fiyatAlaniSemasi,
    tip: z.enum(["YUZDE", "TUTAR"]),
    yon: z.enum(["ZAM", "INDIRIM"]),
    deger: z
      .string()
      .transform(metniSayiyaCevir)
      .refine((n) => Number.isFinite(n) && n > 0, "Geçerli bir tutar girin."),
    idler: z
      .array(z.coerce.number().int().positive())
      .min(1, "En az bir stok kartı seçilmelidir."),
  })
  .refine((v) => v.tip !== "YUZDE" || v.deger <= 100, {
    message: "Yüzde 100'den büyük olamaz.",
    path: ["deger"],
  })

export type TopluFiyatGirdisi = z.infer<typeof topluFiyatSemasi>
