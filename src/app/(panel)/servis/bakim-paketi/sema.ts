import { z } from "zod"

import { metniSayiyaCevir } from "@/lib/sayi"

/**
 * BAKIM PAKETİ — doğrulama kuralları
 *
 * Selpar'daki "Servis > Tanımlamalar > Bakım Paketi" ekranının karşılığı.
 * Paket başlığı (kod/ad/koşullar) ile paket satırları ayrı formlar; iki şema
 * da burada, çünkü sunucu ve tarayıcı aynı kuralı kullanmalı.
 */

const metin = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `En fazla ${max} karakter olabilir.`)
    .transform((d) => (d === "" ? undefined : d))
    .optional()

/**
 * Türkçe klavyeyle "1.250,50" da yazılabiliyor; ondalık ayırıcı burada
 * normalleştiriliyor (işçilik modülündeki `ondalik` ile aynı davranış).
 */
const ondalik = (max: number, alanAdi: string) =>
  z
    .string()
    .trim()
    .transform((d) => (d === "" ? 0 : metniSayiyaCevir(d)))
    .refine((d) => Number.isFinite(d) && d >= 0 && d <= max, `${alanAdi} geçersiz.`)

/** Boş bırakılabilen sayısal alan (km, sabit fiyat). */
const ondalikBos = (max: number, alanAdi: string) =>
  z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : metniSayiyaCevir(d)))
    .refine(
      (d) => d === undefined || (Number.isFinite(d) && d >= 0 && d <= max),
      `${alanAdi} geçersiz.`
    )

export const paketSemasi = z.object({
  // Boş bırakılırsa numaratörden üretilir (cari/işçilik kodundaki mantık).
  kod: metin(30),
  ad: z.string().trim().min(2, "Paket adı zorunlu.").max(200, "Paket adı çok uzun."),
  aciklama: metin(1000),
  aracTuru: metin(60),
  marka: metin(60),
  km: ondalikBos(9_999_999, "Km"),
  aktif: z.coerce.boolean().default(true),
})

export type PaketGirdisi = z.infer<typeof paketSemasi>

export const paketKalemSemasi = z
  .object({
    id: z
      .string()
      .trim()
      .transform((d) => (d === "" ? undefined : Number(d)))
      .optional(),
    paketId: z.coerce.number().int().positive(),
    tur: z.enum(["PARCA", "ISCILIK", "DIS_HIZMET"]),
    stokId: z
      .string()
      .trim()
      .transform((d) => (d === "" ? undefined : Number(d)))
      .optional(),
    iscilikId: z
      .string()
      .trim()
      .transform((d) => (d === "" ? undefined : Number(d)))
      .optional(),
    aciklama: z.string().trim().min(2, "Satır açıklaması zorunlu.").max(300),
    miktar: ondalik(999_999, "Miktar"),
    birim: z.string().trim().max(20).default("ADET"),
    fiyatSabit: ondalikBos(9_999_999, "Sabit fiyat"),
  })
  .refine((v) => v.miktar > 0, { message: "Miktar sıfırdan büyük olmalı.", path: ["miktar"] })

export type PaketKalemGirdisi = z.infer<typeof paketKalemSemasi>
