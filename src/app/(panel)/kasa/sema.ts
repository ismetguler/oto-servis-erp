import { z } from "zod"

import { metniSayiyaCevir } from "@/lib/sayi"

/**
 * KASA — doğrulama şemaları
 *
 * Selpar'da kasa serbest metin bir alandı (`Tahsilat.kasaBanka`). Kart hâline
 * getirildiği için burada hem kart hem hareket hem virman şeması var.
 */

const metin = (enCok: number) =>
  z
    .string()
    .trim()
    .max(enCok, `En fazla ${enCok} karakter olabilir.`)
    .transform((d) => (d === "" ? undefined : d))
    .optional()

/**
 * "1.250,50" ve "1250.50" biçimlerinin ikisini de kabul eder.
 * Çevirinin kendisi `lib/sayi.ts`te — burada yalnızca boş metnin 0 sayılması
 * kalıyor, çünkü kasa/çek/tahsilat alanlarında boş "sıfır tutar" demek.
 */
export function tutaraCevir(ham: unknown): number {
  if (String(ham ?? "").trim() === "") return 0
  return metniSayiyaCevir(ham)
}

const tutarAlani = (etiket: string, sifirOlabilir = false) =>
  z
    .unknown()
    .transform(tutaraCevir)
    .refine((d) => Number.isFinite(d), `${etiket} sayı olmalı.`)
    .refine((d) => (sifirOlabilir ? d >= 0 : d > 0), `${etiket} sıfırdan büyük olmalı.`)
    .refine((d) => d < 1_000_000_000, `${etiket} çok büyük.`)

export const kasaSemasi = z.object({
  kod: metin(30),
  ad: z.string().trim().min(2, "Kasa adı zorunlu.").max(120, "Kasa adı çok uzun."),
  tur: z.enum(["NAKIT", "BANKA", "POS"], { message: "Kasa türü seçin." }),
  paraBirimi: z
    .string()
    .trim()
    .max(3)
    .transform((d) => (d === "" ? "TRY" : d.toUpperCase())),
  banka: metin(80),
  bankaSube: metin(80),
  hesapNo: metin(40),
  ibanNo: metin(40),
  // Alan yalnızca POS türünde ekranda görünüyor; NAKIT/BANKA seçiliyken form
  // hiç göndermiyor. `.optional()` olmadan zod, eksik anahtarı "undefined
  // değer" değil "alan yok" sayıp reddediyordu — bu yüzden burada zorunlu.
  posKomisyonOrani: z
    .unknown()
    .optional()
    .transform(tutaraCevir)
    .refine((d) => Number.isFinite(d) && d >= 0 && d <= 100, "Komisyon oranı %0-100 arası olmalı."),
  acilisBakiye: z
    .unknown()
    .transform(tutaraCevir)
    .refine((d) => Number.isFinite(d), "Açılış bakiyesi sayı olmalı.")
    .refine((d) => Math.abs(d) < 1_000_000_000, "Açılış bakiyesi çok büyük."),
  notu: metin(1000),
  sira: z
    .string()
    .trim()
    .transform((d) => (d === "" ? 0 : Number(d)))
    .refine((d) => Number.isInteger(d) && d >= 0 && d <= 9999, "Sıra geçersiz."),
  // İşaretsiz checkbox FormData'ya HİÇ girmez; `.optional()` olmadan zod eksik
  // anahtarı reddedip "kasa pasife alınamıyor" hatası veriyordu (posKomisyonOrani
  // ile aynı tuzak).
  aktif: z
    .unknown()
    .optional()
    .transform((d) => d === "on" || d === "true" || d === true),
})

/** Elle girilen kasa giriş/çıkış satırı. */
export const kasaHareketSemasi = z.object({
  kasaId: z.coerce.number().int().positive("Kasa seçin."),
  tur: z.enum(["GIRIS", "CIKIS"], { message: "Giriş mi çıkış mı seçin." }),
  tarih: z
    .string()
    .trim()
    .min(1, "Tarih zorunlu.")
    .refine((d) => !Number.isNaN(Date.parse(d)), "Tarih geçersiz."),
  tutar: tutarAlani("Tutar"),
  aciklama: z.string().trim().min(2, "Açıklama zorunlu.").max(300, "Açıklama çok uzun."),
  belgeNo: metin(40),
  masrafTuru: metin(80),
  cariId: z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : Number(d)))
    .refine((d) => d === undefined || Number.isInteger(d), "Cari geçersiz.")
    .optional(),
})

/** Kasalar arası virman: tek formdan iki satır üretilir. */
export const virmanSemasi = z
  .object({
    kaynakKasaId: z.coerce.number().int().positive("Çıkış kasasını seçin."),
    hedefKasaId: z.coerce.number().int().positive("Giriş kasasını seçin."),
    tarih: z
      .string()
      .trim()
      .min(1, "Tarih zorunlu.")
      .refine((d) => !Number.isNaN(Date.parse(d)), "Tarih geçersiz."),
    tutar: tutarAlani("Tutar"),
    aciklama: metin(300),
  })
  .refine((v) => v.kaynakKasaId !== v.hedefKasaId, {
    message: "Aynı kasadan aynı kasaya virman yapılamaz.",
    path: ["hedefKasaId"],
  })
