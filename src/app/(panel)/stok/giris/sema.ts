import { z } from "zod"

import { metniSayiyaCevir } from "@/lib/sayi"

/**
 * STOK GİRİŞİ (SA-5 / madde 18) — doğrulama.
 *
 * Alış faturası olmadan depoya mal girişi. Her satır MEVCUT bir stok
 * kartına bağlıdır (yeni ürün burada açılmaz — kartı yoksa önce Stok
 * Kartı ekranından açılır). Kalemler formdan paralel dizi alanları
 * (`stokId[]`, `miktar[]`, `birimFiyat[]`) olarak gelir.
 */
const sayi = (alanAdi: string, enAz = 0) =>
  z
    .string()
    .trim()
    .transform((d) => (d === "" ? 0 : metniSayiyaCevir(d)))
    .refine((d) => Number.isFinite(d), `${alanAdi} sayı olmalı.`)
    .refine((d) => d >= enAz, `${alanAdi} ${enAz === 0 ? "negatif olamaz" : "geçersiz"}.`)

export const stokGirisiSemasi = z
  .object({
    depoId: z
      .string()
      .trim()
      .transform((d) => (d === "" ? undefined : Number(d)))
      .optional()
      .refine((d) => d === undefined || Number.isInteger(d), "Depo geçersiz."),
    saticiAdi: z
      .string()
      .trim()
      .max(200, "Satıcı adı çok uzun.")
      .transform((d) => (d === "" ? null : d)),
    aciklama: z
      .string()
      .trim()
      .max(500, "Açıklama çok uzun.")
      .transform((d) => (d === "" ? null : d)),
    stokId: z.array(z.coerce.number().int().positive()),
    miktar: z.array(sayi("Miktar")),
    birimFiyat: z.array(sayi("Alış fiyatı")),
  })
  .superRefine((v, ctx) => {
    if (v.stokId.length === 0) {
      ctx.addIssue({ code: "custom", message: "En az bir ürün ekleyin." })
      return
    }
    if (v.stokId.length !== v.miktar.length || v.stokId.length !== v.birimFiyat.length) {
      ctx.addIssue({ code: "custom", message: "Satır verileri eksik geldi." })
      return
    }
    if (new Set(v.stokId).size !== v.stokId.length) {
      ctx.addIssue({ code: "custom", message: "Aynı ürün birden fazla satırda." })
    }
    v.miktar.forEach((m, i) => {
      if (m <= 0) ctx.addIssue({ code: "custom", message: `${i + 1}. satırda miktar 0 olamaz.` })
    })
  })

export type StokGirisiGirdisi = z.infer<typeof stokGirisiSemasi>
