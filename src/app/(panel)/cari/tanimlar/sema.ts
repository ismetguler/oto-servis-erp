import { z } from "zod"

/**
 * PLASİYER (SORUMLU PERSONEL) TANIMLARI
 *
 * Plasiyer bir KİŞİ; ileride komisyonu, mesaisi, borç-alacağı olacak ->
 * `Cari` (turu = PERSONEL), Selpar'daki yapının aynısı. Buradaki şema cari
 * alanlarının küçük bir alt kümesi (tam kart hâlâ /cari/[id]/duzenle
 * üzerinden).
 */

const bosaUndefined = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `En fazla ${max} karakter olabilir.`)
    .transform((d) => (d === "" ? undefined : d))
    .optional()

export const plasiyerSemasi = z.object({
  unvan: z.string().trim().min(2, "Sorumlu personel adı zorunlu.").max(200, "Ad çok uzun."),
  kod: bosaUndefined(30),
  gsm: bosaUndefined(30),
  email: z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : d))
    .optional()
    .refine(
      (d) => d === undefined || z.email().safeParse(d).success,
      "Geçerli bir e-posta adresi yazın."
    ),
})
