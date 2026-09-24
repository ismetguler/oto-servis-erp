import { z } from "zod"

/**
 * ARAÇ KARTI — doğrulama kuralları
 *
 * Cari şemasındaki yaklaşımın aynısı: tek kaynak, hem sunucu hem tarayıcı
 * aynı kuralları kullanır. Alanlar VERİ-MODELİ.md'deki Selpar "AracTanimla"
 * ve "Araç Kabul / Araç Bilgileri" bölümlerinden birebir alındı.
 */

const metin = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, `En fazla ${max} karakter olabilir.`)
    .transform((d) => (d === "" ? undefined : d))
    .optional()

const tamSayi = (max: number, alanAdi: string) =>
  z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : Number(d)))
    .optional()
    .refine(
      (d) => d === undefined || (Number.isInteger(d) && d >= 0 && d <= max),
      `${alanAdi} geçersiz.`
    )

/** Tarih inputu boş gelebilir; boşsa undefined, doluysa Date'e çevrilir. */
const tarihAlani = (alanAdi: string) =>
  z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : d))
    .optional()
    .refine((d) => d === undefined || !Number.isNaN(Date.parse(d)), `${alanAdi} geçersiz tarih.`)

export const aracSemasi = z.object({
  // --- kimlik ---
  plaka: z
    .string()
    .trim()
    .min(1, "Plaka zorunlu.")
    .max(15, "Plaka çok uzun.")
    .transform((d) => d.toLocaleUpperCase("tr-TR").replace(/\s+/g, "")),
  saseNo: metin(40),
  cariId: z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : Number(d)))
    .optional()
    .refine((d) => d === undefined || Number.isInteger(d), "Sahip cari geçersiz."),

  // --- araç bilgileri ---
  aracTuru: metin(60),
  marka: metin(60),
  model: metin(60),
  modelYili: tamSayi(2100, "Model yılı"),
  renk: metin(40),
  yakitTuru: metin(40),
  vitesTuru: metin(40),
  kasaTipi: metin(40),
  motorHacmi: metin(20),
  sonKm: tamSayi(9_999_999, "Son km"),
  projesi: metin(100),
  aracVersiyon: metin(60),

  // --- ruhsat ---
  ruhsatTarihi: tarihAlani("Ruhsat tarihi"),
  ruhsatSeriNo: metin(40),
  ruhsatQr: metin(2000),

  // --- sigorta / garanti / muayene ---
  trafikSigBaslama: tarihAlani("Trafik sigortası başlangıç"),
  trafikSigBitis: tarihAlani("Trafik sigortası bitiş"),
  kaskoBaslama: tarihAlani("Kasko başlangıç"),
  kaskoBitis: tarihAlani("Kasko bitiş"),
  garantiBaslangic: tarihAlani("Garanti başlangıç"),
  garantiBitis: tarihAlani("Garanti bitiş"),
  muayeneBitis: tarihAlani("Muayene bitiş"),
  akuBaslama: tarihAlani("Akü başlangıç"),
  akuBitis: tarihAlani("Akü bitiş"),
  akuMarka: metin(60),
  lpgTankSonTarih: tarihAlani("LPG tank tarihi"),
  lpgTankMarka: metin(60),

  // --- periyodik bakım takibi ---
  sonrakiBakimTarih: tarihAlani("Sonraki bakım tarihi"),
  sonrakiBakimKm: tamSayi(9_999_999, "Sonraki bakım km"),
  trigerDegisimKm: tamSayi(9_999_999, "Triger değişim km"),
  trigerDegisimTarih: tarihAlani("Triger değişim tarihi"),

  // --- Selpar dış-sistem referans kodları (parite, elle girilir) ---
  aracIdSi: metin(60),
  moKodu: metin(60),
  poKodu: metin(60),

  notlar: metin(1000),
  aktif: z.coerce.boolean().default(true),
})

export type AracGirdisi = z.infer<typeof aracSemasi>
