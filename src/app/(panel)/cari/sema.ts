import { z } from "zod"

import { metniSayiyaCevir } from "@/lib/sayi"

/**
 * CARİ FORMU — doğrulama kuralları
 *
 * Bu dosya hem sunucuda (server action) hem tarayıcıda (form) kullanılır.
 * Tek kaynak olması önemli: tarayıcıdaki kontrol sadece kullanıcıya kolaylıktır,
 * asıl güvenlik sunucudaki kontroldür. İkisi ayrı yazılırsa er ya da geç
 * birbirinden ayrışır ve sunucu tarafı unutulur.
 */

/** Boş string'i undefined'a çevirir — HTML formları boş alanı "" olarak yollar. */
const metin = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, `En fazla ${max} karakter olabilir.`)
    .transform((d) => (d === "" ? undefined : d))
    .optional()

/**
 * Formdan gelen sayısal alanlar da metin olarak gelir; hem "45.000,50" (kullanıcı
 * yazımı) hem "45000.5" (formun kayıttan gelen ön değeri) kabul edilir.
 *
 * Nokta yalnızca metinde virgül VARSA binlik ayıracı sayılıyor: eskiden koşulsuz
 * siliniyordu ve kayıtlı bir "12.5" komisyon oranı yeniden kaydedilince 125
 * oluyordu — düzenleme ekranından geçen her ondalık alan sessizce bozuluyordu.
 */
const ondalik = (max: number, alanAdi: string) =>
  z
    .string()
    .trim()
    .transform((d) => (d === "" ? 0 : metniSayiyaCevir(d)))
    .refine((d) => Number.isFinite(d), `${alanAdi} sayı olmalı.`)
    .refine((d) => d >= 0, `${alanAdi} negatif olamaz.`)
    .refine((d) => d <= max, `${alanAdi} çok büyük.`)

/**
 * Ekranda koşullu görünen alanlar için: gizli sekmedeki input FormData'ya
 * hiç girmiyor, zod ise eksik anahtarı "boş" değil "undefined" sayıp
 * reddediyor. Eksik anahtarı boş metne çevirip alt şemaya devrediyoruz.
 */
const formdaOlmayabilir = <T extends z.ZodType>(sema: T) =>
  z.preprocess((d) => (d === undefined ? "" : d), sema)

const tamSayi = (max: number, alanAdi: string) =>
  z
    .string()
    .trim()
    .transform((d) => (d === "" ? 0 : Number(d)))
    .refine((d) => Number.isInteger(d) && d >= 0 && d <= max, `${alanAdi} geçersiz.`)

/** İsteğe bağlı tarih alanı — HTML `date` girdisi boşken "" yollar. */
const tarihAlani = (alanAdi: string) =>
  z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : d))
    .refine(
      (d) => d === undefined || !Number.isNaN(Date.parse(d)),
      `${alanAdi} geçersiz.`
    )
    .optional()

export const cariSemasi = z
  .object({
    // --- kimlik ---
    kod: metin(30),
    unvan: z
      .string()
      .trim()
      .min(2, "Ünvan en az 2 karakter olmalı.")
      .max(200, "Ünvan çok uzun."),
    turu: z.enum(["MUSTERI", "TEDARIKCI", "PERSONEL", "DIGER"]),
    tipi: z.enum(["SAHIS", "SIRKET"]),
    vergiNo: z
      .string()
      .trim()
      .transform((d) => (d === "" ? undefined : d))
      .optional()
      .refine(
        (d) => d === undefined || /^\d{10}$|^\d{11}$/.test(d),
        "VKN 10, TCKN 11 rakam olmalı."
      ),
    vergiDair: metin(100),

    // --- iletişim ---
    yetkili: metin(100),
    yetkiliTelefon: metin(30),
    telefon: metin(30),
    gsm: metin(30),
    email: z
      .string()
      .trim()
      .transform((d) => (d === "" ? undefined : d))
      .optional()
      .refine(
        (d) => d === undefined || z.email().safeParse(d).success,
        "Geçerli bir e-posta adresi yazın."
      ),
    adres: metin(500),
    il: metin(60),
    ilce: metin(60),

    // --- banka ---
    banka: metin(100),
    bankaSube: metin(100),
    hesapNo: metin(50),
    ibanNo: z
      .string()
      .trim()
      .transform((d) => (d === "" ? undefined : d.toUpperCase().replace(/\s+/g, "")))
      .optional()
      .refine(
        (d) => d === undefined || /^TR\d{24}$/.test(d),
        "IBAN 'TR' ile başlamalı ve 26 karakter olmalı."
      ),
    paraBirimi: z.enum(["TRY", "USD", "EUR"]).default("TRY"),

    // --- ticari koşullar ---
    hesapLimiti: ondalik(9_999_999_999, "Hesap limiti"),
    riskLimiti: ondalik(9_999_999_999, "Risk limiti"),
    vadeGun: tamSayi(3650, "Vade günü"),

    // --- açılış bakiyesi ---
    acilisBakiye: ondalik(9_999_999_999, "Açılış bakiyesi"),
    acilisTuru: z.enum(["BORC", "ALACAK"]).default("BORC"),

    // --- sınıflandırma / diğer ---
    ozelKod: metin(50),
    /// Plasiyer = bu cariden sorumlu satış/servis personeli.
    /// Selpar'da olduğu gibi ayrı tablo değil, turu = PERSONEL olan bir cari.
    plasiyerId: z
      .string()
      .trim()
      .transform((d) => (d === "" ? undefined : Number(d)))
      .optional()
      .refine((d) => d === undefined || Number.isInteger(d), "Sorumlu personel geçersiz."),
    musteriSinifi: metin(50),
    notu: metin(1000),

    // --- personel alanları ---
    // Türü PERSONEL olmayan kartta bu sekme hiç render edilmiyor; alanlar
    // FormData'ya BOŞ değil, HİÇ girmiyor. Bu yüzden `formdaOlmayabilir` ile
    // sarılılar — zod eksik anahtarı "boş metin" değil "undefined" görüp
    // reddediyordu ve müşteri/tedarikçi kartı hiç kaydedilemiyordu.
    gorevi: formdaOlmayabilir(metin(100)),
    iseGirisTarihi: formdaOlmayabilir(tarihAlani("İşe giriş tarihi")),
    istenCikisTarihi: formdaOlmayabilir(tarihAlani("İşten çıkış tarihi")),
    dogumTarihi: formdaOlmayabilir(tarihAlani("Doğum tarihi")),
    sgkNo: formdaOlmayabilir(metin(30)),
    maas: formdaOlmayabilir(ondalik(9_999_999_999, "Maaş")),

    aktif: z.coerce.boolean().default(true),
  })
  // Kara liste alanları bilerek bu şemada YOK: durum yalnızca
  // /cari/kara-liste işlemleriyle değişiyor, çünkü her değişiklik
  // "kim, ne zaman, neden" bilgisiyle geçmişe yazılmak zorunda.

export type CariGirdisi = z.infer<typeof cariSemasi>

export const CARI_TUR_ADLARI = {
  MUSTERI: "Müşteri",
  TEDARIKCI: "Tedarikçi",
  PERSONEL: "Personel",
  DIGER: "Diğer",
} as const

export const CARI_TIP_ADLARI = {
  SAHIS: "Şahıs",
  SIRKET: "Şirket",
} as const
