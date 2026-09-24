import { z } from "zod"

/**
 * KULLANICI FORMU — doğrulama kuralları
 *
 * `cari/sema.ts`teki desenle aynı: hem sunucuda hem tarayıcıda kullanılan
 * tek kaynak.
 */

const metin = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, `En fazla ${max} karakter olabilir.`)
    .transform((d) => (d === "" ? undefined : d))
    .optional()

/**
 * Giriş kodu — boşluksuz, yalnız harf/rakam/._- kabul edilir. Selpar'daki
 * ya da giriş ekranındaki ayrı bir normalize fonksiyonu yok (kontrol
 * edildi), bu yüzden kural burada tanımlandı.
 */
export const kullaniciKoduSemasi = z
  .string()
  .trim()
  .min(2, "Kullanıcı adı en az 2 karakter olmalı.")
  .max(60, "Kullanıcı adı çok uzun.")
  .regex(
    /^[A-Za-z0-9._-]+$/,
    "Kullanıcı adı yalnızca harf, rakam, nokta, tire ve alt çizgi içerebilir."
  )

/** Yeni kullanıcı — kod ve ilk şifre burada, düzenlemede yok. */
export const kullaniciEkleSemasi = z.object({
  kod: kullaniciKoduSemasi,
  ad: z.string().trim().min(2, "Ad en az 2 karakter olmalı.").max(100, "Ad çok uzun."),
  soyad: metin(100),
  email: z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : d))
    .optional()
    .refine(
      (d) => d === undefined || z.email().safeParse(d).success,
      "Geçerli bir e-posta adresi yazın."
    ),
  telefon: metin(30),
  rol: z.enum(["YONETICI", "MUHASEBE", "SERVIS_DANISMANI", "USTA", "DEPO"]),
  sifre: z
    .string()
    .min(6, "Şifre en az 6 karakter olmalı.")
    .max(200, "Şifre çok uzun."),
})

/** Düzenleme — kod ve şifre burada YOK: kod kalıcı, şifre ayrı aksiyon. */
export const kullaniciDuzenleSemasi = z.object({
  ad: z.string().trim().min(2, "Ad en az 2 karakter olmalı.").max(100, "Ad çok uzun."),
  soyad: metin(100),
  email: z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : d))
    .optional()
    .refine(
      (d) => d === undefined || z.email().safeParse(d).success,
      "Geçerli bir e-posta adresi yazın."
    ),
  telefon: metin(30),
  rol: z.enum(["YONETICI", "MUHASEBE", "SERVIS_DANISMANI", "USTA", "DEPO"]),
})

export const sifreSifirlaSemasi = z.object({
  kullaniciId: z.coerce.number().int().positive(),
  yeniSifre: z
    .string()
    .min(6, "Şifre en az 6 karakter olmalı.")
    .max(200, "Şifre çok uzun."),
})

/**
 * MODÜL BAZLI İSTİSNA (adım 11.2) — checkbox'lar FormData'da yalnızca
 * işaretliyse "on" olarak gelir, bu yüzden `z.coerce.boolean()` değil
 * "on" karşılaştırması kullanılıyor (coerce her metni true sayardı).
 */
const kutu = z.preprocess((d) => d === "on" || d === true, z.boolean())

export const yetkiIstisnasiSemasi = z.object({
  kullaniciId: z.coerce.number().int().positive(),
  sayfaKodu: z.enum([
    "kabul",
    "arac",
    "cari",
    "tahsilat",
    "stok",
    "iscilik",
    "evrak",
    "siparis",
    "rapor",
    "ayar",
  ]),
  gorebilir: kutu,
  ekleyebilir: kutu,
  duzeltebilir: kutu,
  silebilir: kutu,
})

export type KullaniciEkleGirdisi = z.infer<typeof kullaniciEkleSemasi>
export type KullaniciDuzenleGirdisi = z.infer<typeof kullaniciDuzenleSemasi>
export type YetkiIstisnasiGirdisi = z.infer<typeof yetkiIstisnasiSemasi>
