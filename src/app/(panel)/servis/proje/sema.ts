import { z } from "zod"

/**
 * PROJE TANIMI (Tanim, tur = PROJE)
 *
 * Selpar'da "Servis > Tanımlamalar > Proje": filo/kurumsal işlerin altında
 * toplandığı etiket. Kabul ve araç kartında `projesi` alanı bu listeden seçilir.
 */
export const projeSemasi = z.object({
  ad: z.string().trim().min(2, "Proje adı zorunlu.").max(100, "Proje adı çok uzun."),
  kod: z
    .string()
    .trim()
    .max(20, "En fazla 20 karakter olabilir.")
    .transform((d) => (d === "" ? undefined : d))
    .optional(),
  // Boş bırakılırsa `undefined` — yeni projede listenin SONUNA eklensin diye
  // (eskiden 0'a düşüyordu, mevcut 0 sıralı projeyle aynı yere biniyordu).
  sira: z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : Number(d)))
    .refine(
      (d) => d === undefined || (Number.isInteger(d) && d >= 0 && d <= 9999),
      "Sıra geçersiz.",
    ),
})
