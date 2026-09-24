import { z } from "zod"

import { metniSayiyaCevir } from "@/lib/sayi"

/**
 * ALIŞ FATURASI — doğrulama kuralları
 *
 * Satış faturasının (`evrak/satis/sema.ts`) birebir aynısı; tek fark
 * `kabulId` yok — kabulden dönüştürme yalnız satış/servis tarafına özgü
 * (adım 9.2), alışta karşılığı yok. Kalem şeması ortak (aynı EvrakKalem
 * tablosu, aynı hesap kuralları) olduğu için değiştirilmeden aktarıldı.
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

/** Kart üstü bilgiler — kalemler ayrı ekranda eklenir (satış faturasındaki gibi). */
export const evrakSemasi = z.object({
  evrakNo: z
    .string()
    .trim()
    .min(1, "Fatura no zorunlu.")
    .max(40, "Fatura no en fazla 40 karakter olabilir."),
  cariId: zorunluKimlik("Tedarikçi"),
  tarih: tarihAlani("Tarih"),
  vadeTarihi: tarihAlani("Vade tarihi"),
  aciklama: metin(500),
  /**
   * Adım 11.8: "İade Faturası mı?" — işaretlenirse tür `IADE_ALIS` olur
   * (satış tarafındaki `sema.ts`teki desenin aynısı).
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

/** Kalem satırı — stok kartından seçilebilir veya elle yazılabilir. */
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
