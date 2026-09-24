import { z } from "zod"

/**
 * ARAÇ MODELİ EKLE (SA-5 / madde 15) — doğrulama.
 *
 * Hazır katalog (dış açık veri) `kilitli = true` satırlardır ve buradan
 * DEĞİŞTİRİLEMEZ. Bu form yalnızca elle yeni (kilitli = false) marka/model
 * ekler, düzenler, siler.
 */
const ad = (alan: string, max: number) =>
  z
    .string()
    .trim()
    .min(2, `${alan} en az 2 karakter olmalı.`)
    .max(max, `${alan} en fazla ${max} karakter olabilir.`)

export const aracModelSemasi = z.object({
  marka: ad("Marka", 60),
  model: ad("Model", 80),
})

export type AracModelGirdisi = z.infer<typeof aracModelSemasi>
