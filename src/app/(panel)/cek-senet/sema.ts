import { z } from "zod"

import { tutaraCevir } from "@/app/(panel)/kasa/sema"

/**
 * ÇEK / SENET — doğrulama şemaları
 *
 * Tutar çevirimi kasa modülündeki `tutaraCevir` ile ortak: iki ekranda iki
 * farklı ayrıştırma olsaydı "1.500" bir yerde 1500, diğerinde 1,5 olurdu.
 */

const metin = (enCok: number) =>
  z
    .string()
    .trim()
    .max(enCok, `En fazla ${enCok} karakter olabilir.`)
    .transform((d) => (d === "" ? undefined : d))
    .optional()

// İki ayrı fonksiyon: tek fonksiyonda ternary dönüş tipini `string | undefined`
// birleşimine genelleştiriyor, zorunlu alanlarda `new Date(...)` çağrısı
// TypeScript'te "undefined olabilir" hatası veriyordu.
const zorunluTarihAlani = (etiket: string) =>
  z
    .string()
    .trim()
    .min(1, `${etiket} zorunlu.`)
    .refine((d) => !Number.isNaN(Date.parse(d)), `${etiket} geçersiz.`)

const istegeBagliTarihAlani = (etiket: string) =>
  z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : d))
    .refine((d) => d === undefined || !Number.isNaN(Date.parse(d)), `${etiket} geçersiz.`)
    .optional()

export const cekSenetSemasi = z.object({
  portfoyNo: metin(30),
  tur: z.enum(["CEK", "SENET"], { message: "Çek mi senet mi seçin." }),
  yon: z.enum(["ALINAN", "VERILEN"], { message: "Alınan mı verilen mi seçin." }),
  cariId: z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : Number(d)))
    .refine((d) => d === undefined || Number.isInteger(d), "Cari geçersiz.")
    .optional(),
  tutar: z
    .unknown()
    .transform(tutaraCevir)
    .refine((d) => Number.isFinite(d), "Tutar sayı olmalı.")
    .refine((d) => d > 0, "Tutar sıfırdan büyük olmalı.")
    .refine((d) => d < 1_000_000_000, "Tutar çok büyük."),
  paraBirimi: z
    .string()
    .trim()
    .max(3)
    .transform((d) => (d === "" ? "TRY" : d.toUpperCase())),
  vadeTarihi: zorunluTarihAlani("Vade tarihi"),
  kesideTarihi: istegeBagliTarihAlani("Keşide tarihi"),
  kesideYeri: metin(80),
  borclu: metin(120),
  banka: metin(80),
  bankaSube: metin(80),
  hesapNo: metin(40),
  belgeNo: metin(40),
  aciklama: metin(1000),
})

/** Durum değiştirme katmanı — hangi geçişin hangi ek bilgiyi istediği burada. */
export const durumSemasi = z.object({
  id: z.coerce.number().int().positive(),
  yeniDurum: z.enum([
    "PORTFOYDE",
    "TAHSILDE",
    "TAHSIL_EDILDI",
    "ODENDI",
    "KARSILIKSIZ",
    "CIRO_EDILDI",
    "IADE_EDILDI",
  ]),
  kasaId: z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : Number(d)))
    .refine((d) => d === undefined || Number.isInteger(d), "Kasa geçersiz.")
    .optional(),
  ciroCariId: z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : Number(d)))
    .refine((d) => d === undefined || Number.isInteger(d), "Cari geçersiz.")
    .optional(),
  tarih: istegeBagliTarihAlani("İşlem tarihi"),
  aciklama: metin(300),
})

export const onaySemasi = z.object({
  id: z.coerce.number().int().positive(),
  karar: z.enum(["ONAYLANDI", "REDDEDILDI"]),
  onayNotu: metin(300),
})
