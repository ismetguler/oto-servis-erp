import { z } from "zod"

import { metniSayiyaCevir } from "@/lib/sayi"

/**
 * ALINAN SİPARİŞ — doğrulama kuralları
 *
 * Alış faturasının (`evrak/alis/sema.ts`) kart şemasıyla aynı iskelet;
 * fark: `evrakNo` yok — sipariş no otomatik üretiliyor (`Numarator`,
 * SIPARIS türü), elle girilmiyor. `vadeTarihi` yerine `teslimTarihi`.
 * Kalem şeması da aynı (aynı hesap kuralları, `lib/hesap.ts`).
 */

const metin = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, `En fazla ${max} karakter olabilir.`)
    .transform((d) => (d === "" ? undefined : d))
    .optional()

const kimlik = (alanAdi: string) =>
  z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : Number(d)))
    .optional()
    .refine((d) => d === undefined || Number.isInteger(d), `${alanAdi} geçersiz.`)

const zorunluKimlik = (alanAdi: string) =>
  z
    .string()
    .trim()
    .min(1, `${alanAdi} zorunlu.`)
    .transform((d) => Number(d))
    .refine((d) => Number.isInteger(d) && d > 0, `${alanAdi} geçersiz.`)

const tarihAlani = (alanAdi: string) =>
  z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : d))
    .optional()
    .refine(
      (d) => d === undefined || !Number.isNaN(Date.parse(d)),
      `${alanAdi} geçersiz tarih.`
    )

const oranAlani = (alanAdi: string, max = 100) =>
  z
    .string()
    .trim()
    .transform((d) => (d === "" ? 0 : metniSayiyaCevir(d)))
    .refine(
      (d) => Number.isFinite(d) && d >= 0 && d <= max,
      `${alanAdi} 0 ile ${max} arasında olmalı.`
    )

/** Kart üstü bilgiler — kalemler ayrı ekranda eklenir (evrak modülündeki gibi). */
export const siparisSemasi = z.object({
  cariId: zorunluKimlik("Müşteri"),
  tarih: tarihAlani("Tarih"),
  teslimTarihi: tarihAlani("Teslim tarihi"),
  aciklama: metin(500),
})

export type SiparisGirdisi = z.infer<typeof siparisSemasi>

/** Kalem satırı — stok kartından seçilebilir veya elle yazılabilir. */
export const siparisKalemSemasi = z.object({
  id: kimlik("Kalem"),
  siparisId: zorunluKimlik("Sipariş"),
  stokId: kimlik("Stok"),
  aciklama: z.string().trim().min(1, "Açıklama zorunlu.").max(300),
  birim: z
    .string()
    .trim()
    .max(20)
    .transform((d) => (d === "" ? "ADET" : d)),
  miktar: z
    .string()
    .trim()
    .transform((d) => metniSayiyaCevir(d === "" ? "1" : d))
    .refine((d) => Number.isFinite(d) && d > 0, "Miktar 0'dan büyük olmalı."),
  birimFiyat: z
    .string()
    .trim()
    .transform((d) => metniSayiyaCevir(d === "" ? "0" : d))
    .refine((d) => Number.isFinite(d) && d >= 0, "Birim fiyat geçersiz."),
  kdvOrani: oranAlani("KDV oranı"),
})

export type SiparisKalemGirdisi = z.infer<typeof siparisKalemSemasi>
