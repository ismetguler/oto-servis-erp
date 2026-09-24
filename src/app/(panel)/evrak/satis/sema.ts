import { z } from "zod"

import { metniSayiyaCevir } from "@/lib/sayi"

/**
 * SATIŞ FATURASI — doğrulama kuralları
 *
 * Şema `Evrak`/`EvrakKalem` (VERİ-MODELİ genel evrak taslağı, SELPAR-ANALIZ
 * "Fatura/Evrak" bölümü) ile birebir örtüşüyor. e-Fatura/e-Arşiv XML kapsam
 * dışı olduğu için fatura no elle girilir; `evrakNo` alanı bunun karşılığı.
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

/** Kart üstü bilgiler — kalemler ayrı ekranda eklenir (kabul kartındaki gibi). */
export const evrakSemasi = z.object({
  evrakNo: z
    .string()
    .trim()
    .min(1, "Fatura no zorunlu.")
    .max(40, "Fatura no en fazla 40 karakter olabilir."),
  cariId: zorunluKimlik("Müşteri"),
  tarih: tarihAlani("Tarih"),
  vadeTarihi: tarihAlani("Vade tarihi"),
  aciklama: metin(500),
  /**
   * Kabulden faturaya dönüştürme (adım 9.2). Doluysa fatura o kabul kartına
   * bağlanır ve kart satırları faturaya KOPYALANIR. Yalnız YENİ faturada
   * anlamlı — mevcut faturanın kabul bağı düzenleme ekranından değişmez.
   */
  kabulId: kimlik("Kabul"),
  /**
   * Adım 11.8: "İade Faturası mı?" seçeneği — yalnız YENİ faturada anlamlı,
   * işaretlenirse tür `IADE_SATIS` olur (aksi `SATIS`). Düzenlemede tür
   * hiç değişmez (actions.ts bu alanı yalnız yeni kayıtta okuyor).
   */
  iade: z
    .string()
    .optional()
    .transform((d) => d === "on"),
  kaynakEvrakNo: metin(40),
  irsaliyeNo: metin(40),
  irsaliyeTarihi: tarihAlani("İrsaliye tarihi"),
  tasiyiciPlaka: metin(20),
  sevkAdresi: metin(500),
  tevkifatKodu: metin(20),
  tevkifatOrani: z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : metniSayiyaCevir(d)))
    .optional()
    .refine((d) => d === undefined || (Number.isFinite(d) && d >= 0 && d <= 100), "Tevkifat oranı 0-100 arasında olmalı."),
})

export type EvrakGirdisi = z.infer<typeof evrakSemasi>

/** Kalem satırı — stok kartından seçilebilir veya elle yazılabilir (hizmet vb.). */
export const evrakKalemSemasi = z.object({
  id: kimlik("Kalem"),
  evrakId: zorunluKimlik("Evrak"),
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

export type EvrakKalemGirdisi = z.infer<typeof evrakKalemSemasi>
