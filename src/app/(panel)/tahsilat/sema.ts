import { z } from "zod"

import { tutaraCevir } from "@/app/(panel)/kasa/sema"

/**
 * TAHSİLAT / ÖDEME (TEDİYE) — doğrulama şemaları
 *
 * Tutar çevirimi kasa modülündeki `tutaraCevir` ile ortak: iki ekranda iki
 * ayrı ayrıştırma olsaydı "1.500" bir yerde 1500, diğerinde 1,5 olurdu.
 */

const metin = (enCok: number) =>
  z
    .string()
    .trim()
    .max(enCok, `En fazla ${enCok} karakter olabilir.`)
    .transform((d) => (d === "" ? undefined : d))
    .optional()

/**
 * Kasaya para giren/çıkan ödeme şekilleri. Çek/senet ile yapılan tahsilat
 * kasaya DEĞMEZ — kâğıt tahsil edilince (Çek-Senet modülü) kasaya düşer;
 * burada da kasa yazılsaydı aynı para iki kez sayılırdı.
 * Mahsup zaten para hareketi değil, cari-cari kapatma.
 */
export const KASALI_ODEME_SEKILLERI = ["NAKIT", "KREDI_KARTI", "HAVALE"] as const

export function kasaGerektirir(odemeSekli: string): boolean {
  return (KASALI_ODEME_SEKILLERI as readonly string[]).includes(odemeSekli)
}

/**
 * Kâğıt (çek/senet) doğuran ödeme şekilleri. Bu fişler kaydedilirken
 * Çek-Senet modülünde OTOMATİK portföy kaydı açılır (adım 6.3) — elle ikinci
 * kez girilseydi aynı kâğıt iki kez takip edilir, vade listesi şişerdi.
 */
export const KAGITLI_ODEME_SEKILLERI = ["CEK", "SENET"] as const

export function kagitGerektirir(odemeSekli: string): boolean {
  return (KAGITLI_ODEME_SEKILLERI as readonly string[]).includes(odemeSekli)
}

/** Sanal POS placeholder alanları yalnız kredi kartında anlamlı. */
export function posAlanlariGorunur(odemeSekli: string): boolean {
  return odemeSekli === "KREDI_KARTI"
}

/**
 * Çek/senet ve POS alanları — iki şemada da aynı, tek yerde duruyor.
 * `cekVadeTarihi` şemada zorunlu DEĞİL; zorunluluk ödeme şeklini de gören
 * `.refine` katmanında (aşağıda) kuruluyor. Dışa açık: Hızlı Satış (9.3)
 * kendi şemasında aynı alanları yeniden yazmadan buradan yayıyor.
 */
export const kagitVePosAlanlari = {
  cekVadeTarihi: z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : d))
    .refine((d) => d === undefined || !Number.isNaN(Date.parse(d)), "Vade tarihi geçersiz.")
    .optional(),
  cekBelgeNo: metin(50),
  cekBanka: metin(100),
  cekBorclu: metin(200),
  posBanka: metin(100),
  posKartSahibi: metin(200),
  posSon4: z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : d))
    .refine((d) => d === undefined || /^\d{4}$/.test(d), "Son 4 hane 4 rakam olmalı.")
    .optional(),
  posProvizyon: metin(50),
  posTaksit: z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : Number(d)))
    .refine((d) => d === undefined || (Number.isInteger(d) && d >= 1 && d <= 36), "Taksit 1-36 arası olmalı.")
    .optional(),
}

/** İki şemanın da uyguladığı ortak kural: kâğıtlı ödemede vade zorunlu. */
export const vadeVar = (v: { odemeSekli: string; cekVadeTarihi?: string }) =>
  !kagitGerektirir(v.odemeSekli) || !!v.cekVadeTarihi

export const vadeHatasi = {
  message: "Çek / senet için vade tarihi zorunlu.",
  path: ["cekVadeTarihi"] as PropertyKey[],
}

export const tahsilatSemasi = z
  .object({
    tur: z.enum(["TAHSILAT", "TEDIYE"], { message: "Tahsilat mı ödeme mi seçin." }),
    fisNo: metin(30),
    cariId: z.coerce.number().int().positive("Cari seçin."),
    tarih: z
      .string()
      .trim()
      .min(1, "Tarih zorunlu.")
      .refine((d) => !Number.isNaN(Date.parse(d)), "Tarih geçersiz."),
    tutar: z
      .unknown()
      .transform(tutaraCevir)
      .refine((d) => Number.isFinite(d), "Tutar sayı olmalı.")
      .refine((d) => d > 0, "Tutar sıfırdan büyük olmalı.")
      .refine((d) => d < 1_000_000_000, "Tutar çok büyük."),
    odemeSekli: z.enum(["NAKIT", "KREDI_KARTI", "HAVALE", "CEK", "SENET", "MAHSUP"], {
      message: "Ödeme şeklini seçin.",
    }),
    kasaId: z
      .string()
      .trim()
      .transform((d) => (d === "" ? undefined : Number(d)))
      .refine((d) => d === undefined || Number.isInteger(d), "Kasa geçersiz.")
      .optional(),
    kabulId: z
      .string()
      .trim()
      .transform((d) => (d === "" ? undefined : Number(d)))
      .refine((d) => d === undefined || Number.isInteger(d), "Kabul kartı geçersiz.")
      .optional(),
    aciklama: metin(1000),
    ...kagitVePosAlanlari,
  })
  .refine((v) => !kasaGerektirir(v.odemeSekli) || !!v.kasaId, {
    message: "Nakit / kredi kartı / havale işleminde kasa seçilmelidir.",
    path: ["kasaId"],
  })
  .refine(vadeVar, vadeHatasi)

/**
 * HIZLI TAHSİLAT (adım 6.2) — kabul kartının üstünden açılan modalin şeması.
 *
 * Ayrı şema, çünkü burada cari ve tür seçilmiyor: ikisi de kabul kartından
 * geliyor. Kullanıcıya sorulsaydı yanlış cariye tahsilat girilebilirdi.
 * Kasa kuralı fiş şemasıyla aynı — `kasaGerektirir` tek yerde duruyor.
 */
export const hizliTahsilatSemasi = z
  .object({
    kabulId: z.coerce.number().int().positive("Kabul kartı geçersiz."),
    tarih: z
      .string()
      .trim()
      .min(1, "Tarih zorunlu.")
      .refine((d) => !Number.isNaN(Date.parse(d)), "Tarih geçersiz."),
    tutar: z
      .unknown()
      .transform(tutaraCevir)
      .refine((d) => Number.isFinite(d), "Tutar sayı olmalı.")
      .refine((d) => d > 0, "Tutar sıfırdan büyük olmalı.")
      .refine((d) => d < 1_000_000_000, "Tutar çok büyük."),
    odemeSekli: z.enum(["NAKIT", "KREDI_KARTI", "HAVALE", "CEK", "SENET", "MAHSUP"], {
      message: "Ödeme şeklini seçin.",
    }),
    kasaId: z
      .string()
      .trim()
      .transform((d) => (d === "" ? undefined : Number(d)))
      .refine((d) => d === undefined || Number.isInteger(d), "Kasa geçersiz.")
      .optional(),
    aciklama: metin(1000),
    ...kagitVePosAlanlari,
  })
  .refine((v) => !kasaGerektirir(v.odemeSekli) || !!v.kasaId, {
    message: "Nakit / kredi kartı / havale işleminde kasa seçilmelidir.",
    path: ["kasaId"],
  })
  .refine(vadeVar, vadeHatasi)
