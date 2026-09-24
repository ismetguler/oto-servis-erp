import { z } from "zod"

import { metniSayiyaCevir } from "@/lib/sayi"

/**
 * Yeni sayım fişi formu — filtreye uyan stoklardan sayılan (dolu bırakılan)
 * satırlar gönderilir. Boş bırakılan satır hiç kaleme dönüşmez, o stok
 * "sayılmayanlar" listesinde kalır (fişe girmemiş demektir).
 */
export const sayimSatiriSemasi = z.object({
  stokId: z.coerce.number().int().positive(),
  sayilanMiktar: z
    .string()
    .transform(metniSayiyaCevir)
    .refine((n) => Number.isFinite(n) && n >= 0, "Geçerli bir miktar girin."),
})

export const sayimOlusturSemasi = z.object({
  depoId: z.coerce.number().int().positive().nullable(),
  urunGrubu: z.string().nullable(),
  aciklama: z.string().trim().max(500).nullable(),
  satirlar: z.array(sayimSatiriSemasi).min(1, "En az bir stoğa sayım miktarı girilmelidir."),
})

export type SayimOlusturGirdisi = z.infer<typeof sayimOlusturSemasi>
