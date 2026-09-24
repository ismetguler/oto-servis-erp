import { z } from "zod"

import { metniSayiyaCevir } from "@/lib/sayi"

/**
 * STOK KARTI FORMU — doğrulama kuralları
 *
 * Selpar'daki "Stok Ekle" ekranının (bkz. VERİ-MODELİ.md) alanları buraya
 * taşındı. Cari/İşçilik şemalarındaki desenin aynısı: tek kaynak, hem
 * sunucu hem tarayıcı bunu kullanır.
 */

const metin = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, `En fazla ${max} karakter olabilir.`)
    .transform((d) => (d === "" ? undefined : d))
    .optional()

/**
 * Formdan gelen sayısal alanlar da metin olarak gelir; hem "45.000,50"
 * (kullanıcı yazımı) hem "45000.5" (kayıttan gelen ön değer) kabul edilir.
 */
const ondalik = (max: number, alanAdi: string) =>
  z
    .string()
    .trim()
    .transform((d) => (d === "" ? 0 : metniSayiyaCevir(d)))
    .refine((d) => Number.isFinite(d), `${alanAdi} sayı olmalı.`)
    .refine((d) => d >= 0, `${alanAdi} negatif olamaz.`)
    .refine((d) => d <= max, `${alanAdi} çok büyük.`)

/** Model yılı — boş geçilebilir; doluysa makul bir aralıkta tam sayı. */
const yilAlani = z
  .string()
  .trim()
  .transform((d) => (d === "" ? undefined : Number(d)))
  .optional()
  .refine(
    (d) => d === undefined || (Number.isInteger(d) && d >= 1950 && d <= 2100),
    "Model yılı geçersiz."
  )

export const stokSemasi = z.object({
  // --- temel ---
  kod: metin(30),
  ad: z.string().trim().min(2, "Ürün adı en az 2 karakter olmalı.").max(200, "Ürün adı çok uzun."),
  barkod: metin(50),
  tipi: metin(30),
  uretici: metin(100),
  ureticiKodu: metin(50),
  orijinalKodu: metin(50),
  muadilNo: metin(200),
  ozelNo: metin(50),

  // --- sınıflandırma ---
  grupKodu: metin(50),
  urunGrubu: metin(100),
  gtipNo: metin(20),

  // --- stok ---
  birim: z
    .string()
    .trim()
    .max(20, "En fazla 20 karakter olabilir.")
    .transform((d) => (d === "" ? "ADET" : d)),
  acilisMiktar: ondalik(9_999_999, "Açılış miktarı"),
  minSeviye: ondalik(9_999_999, "Minimum seviye"),
  maxSeviye: ondalik(9_999_999, "Maksimum seviye"),
  depoId: z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : Number(d)))
    .optional()
    .refine((d) => d === undefined || Number.isInteger(d), "Depo geçersiz."),
  rafYeri: metin(50),

  // --- fiyat ---
  alisFiyat: ondalik(9_999_999_999, "Alış fiyatı"),
  satisFiyat: ondalik(9_999_999_999, "Satış fiyatı"),
  ortalamaMaliyet: ondalik(9_999_999_999, "Ortalama maliyet"),
  kdvOrani: ondalik(100, "KDV oranı"),
  paraBirimi: z.enum(["TRY", "USD", "EUR"]).default("TRY"),

  // --- araç uygunluğu (tipi = ARAC) ---
  uygunMarka: metin(60),
  uygunModel: metin(60),
  uygunYilBas: yilAlani,
  uygunYilBit: yilAlani,

  // --- lastik alanları (Selpar lastikçilere de hitap ediyor) ---
  desen: metin(50),
  mevsim: metin(30),
  hizYuk: metin(20),
  yakitDirenci: metin(10),
  gurultuSeviyesi: metin(20),
  gurultuSinifi: metin(20),

  // --- diğer ---
  resimUrl: metin(500),
  teknikBilgi: metin(2000),
  aciklama: metin(2000),
  aktif: z.coerce.boolean().default(true),
})

export type StokGirdisi = z.infer<typeof stokSemasi>

/**
 * Ürün tipi (SA-5 / madde 19). Üç değere sabitlendi; forma göre alanlar
 * değişir (bkz. stok-formu.tsx). Eski kayıtlardaki boş / "SARF" / "LASTIK"
 * değerleri kod tarafında PARCA sayılır — veri taşıma migration'ı yok.
 *   PARCA  — normal yedek parça / sarf malzeme (mevcut davranış)
 *   HIZMET — stoğu tutulmayan hizmet satırı (asıl yönetim İşçilik Kataloğu'nda)
 *   ARAC   — belirli bir araca özel parça (marka/model/yıl uygunluğu girilir)
 */
export const URUN_TIPI_SECENEKLERI = ["PARCA", "HIZMET", "ARAC"] as const
export type UrunTipi = (typeof URUN_TIPI_SECENEKLERI)[number]

export const URUN_TIPI_ADLARI: Record<UrunTipi, string> = {
  PARCA: "Parça / Sarf",
  HIZMET: "Hizmet",
  ARAC: "Araca Özel Parça",
}

/** Kayıttan gelen ham `tipi` değerini üç geçerli tipten birine indirger. */
export function urunTipiNormalize(ham: string | null | undefined): UrunTipi {
  return ham === "HIZMET" || ham === "ARAC" ? ham : "PARCA"
}

export const PARA_BIRIMI_ADLARI = {
  TRY: "TRY — Türk Lirası",
  USD: "USD — Dolar",
  EUR: "EUR — Euro",
} as const
