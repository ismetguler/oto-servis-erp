import { z } from "zod"

import { GENEL_TANIM_TURLERI } from "@/lib/tanim-turleri"

/**
 * TANIMLAR — doğrulama kuralları
 *
 * `iscilik/sema.ts`teki `bolumSemasi` deseninin genelleştirilmiş hali:
 * aynı alanlar (ad, kod, sıra), farkı `tur`un da formdan gelip
 * `GENEL_TANIM_TURLERI` (özel ekranlı üç tür HARİÇ) ile sınırlanması.
 */
const metin = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `En fazla ${max} karakter olabilir.`)
    .transform((d) => (d === "" ? undefined : d))
    .optional()

export const tanimSemasi = z.object({
  tur: z.enum(GENEL_TANIM_TURLERI as [string, ...string[]], "Geçersiz tanım türü."),
  ad: z.string().trim().min(2, "Ad en az 2 karakter olmalı.").max(150, "Ad çok uzun."),
  kod: metin(20),
  sira: z
    .string()
    .trim()
    .transform((d) => (d === "" ? 0 : Number(d)))
    .refine((d) => Number.isInteger(d) && d >= 0 && d <= 9999, "Sıra geçersiz."),
})

export type TanimGirdisi = z.infer<typeof tanimSemasi>
