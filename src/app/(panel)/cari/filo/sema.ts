import { z } from "zod"

import { metniSayiyaCevir } from "@/lib/sayi"

/**
 * SA-3.3 — BASİT filo sözleşmesi zod şeması. Az alan: ad, tarih aralığı,
 * vade (gün), opsiyonel kapsam plakaları + not. Dosya yükleme yok.
 */
const gun = z
  .string()
  .optional()
  .transform((d) => (d && d.trim() !== "" ? Math.trunc(metniSayiyaCevir(d)) : 0))
  .refine((n) => Number.isFinite(n) && n >= 0 && n <= 3650, "Geçerli bir gün sayısı girin.")

export const filoSozlesmesiSemasi = z
  .object({
    id: z.string().optional(),
    cariId: z.coerce.number().int().positive("Cari geçersiz."),
    ad: z.string().trim().min(2, "Sözleşme adı en az 2 karakter olmalı.").max(120),
    baslangic: z.string().min(1, "Başlangıç tarihi zorunlu."),
    bitis: z.string().min(1, "Bitiş tarihi zorunlu."),
    vadeGun: gun,
    kapsamPlakalari: z.string().trim().max(2000).optional().default(""),
    notu: z.string().trim().max(1000).optional().default(""),
    aktif: z.boolean().default(true),
  })
  .refine(
    (v) => new Date(v.baslangic) <= new Date(v.bitis),
    { message: "Bitiş tarihi başlangıçtan önce olamaz.", path: ["bitis"] }
  )

export type FiloSozlesmesiGirdi = z.infer<typeof filoSozlesmesiSemasi>
