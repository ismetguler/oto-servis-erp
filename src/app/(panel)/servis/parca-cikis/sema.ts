import { z } from "zod"

import { metniSayiyaCevir } from "@/lib/sayi"

/**
 * KABUL PARÇA ÇIKIŞI — doğrulama kuralları
 *
 * Selpar'daki "Kabul Parça Çıkışı" depocunun ekranı: kabul seçilir, parça
 * barkodu okutulur, adet girilir, satır kabule düşer. Kabul kartındaki
 * kalem formuna göre çok daha dar — indirim, personel, KDV gibi alanlar
 * burada sorulmaz, katalogdan/karttan gelir.
 */

const kimlik = (alanAdi: string) =>
  z
    .string()
    .trim()
    .min(1, `${alanAdi} zorunlu.`)
    .transform((d) => Number(d))
    .refine((d) => Number.isInteger(d) && d > 0, `${alanAdi} geçersiz.`)

export const parcaCikisSemasi = z.object({
  kabulId: kimlik("Kabul"),
  stokId: kimlik("Stok"),
  miktar: z
    .string()
    .trim()
    .transform((d) => metniSayiyaCevir(d === "" ? "1" : d))
    .refine((d) => Number.isFinite(d) && d > 0, "Adet 0'dan büyük olmalı.")
    .refine((d) => d <= 999_999, "Adet çok büyük."),
  /** Elle değiştirilebilen satış fiyatı; boşsa stok kartındaki fiyat geçerli. */
  birimFiyat: z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : metniSayiyaCevir(d)))
    .optional()
    .refine((d) => d === undefined || (Number.isFinite(d) && d >= 0), "Fiyat geçersiz."),
  /** Stok yetersizken kullanıcı uyarıyı onayladıysa çıkış yine de yazılır. */
  stokUyarisiOnaylandi: z.coerce.boolean().default(false),
  garantili: z.coerce.boolean().default(false),
})

export type ParcaCikisGirdisi = z.infer<typeof parcaCikisSemasi>
