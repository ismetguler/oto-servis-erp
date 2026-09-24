import { z } from "zod"

import { kagitVePosAlanlari, kasaGerektirir, vadeHatasi, vadeVar } from "@/app/(panel)/tahsilat/sema"

/**
 * HIZLI SATIŞ / PERAKENDE — doğrulama şemaları (adım 9.3)
 *
 * Ekran tek adımda çalışıyor: sepet + tahsilat aynı ekranda, "Satışı
 * Tamamla" tek tıkla hem evrakı keser hem tahsilatı yazar. Ödeme tarafı
 * Tahsilat modülüyle birebir aynı kurallardan geçiyor (kasa/çek-senet/POS
 * zorunluluğu) — burada yeniden yazılmadı, `tahsilat/sema.ts`ten yayılıyor.
 */

const kalemSemasi = z.object({
  stokId: z
    .union([z.number().int().positive(), z.null()])
    .optional()
    .transform((d) => d ?? null),
  aciklama: z.string().trim().min(1, "Satır açıklaması zorunlu.").max(300),
  birim: z
    .string()
    .trim()
    .max(20)
    .transform((d) => (d === "" ? "ADET" : d)),
  miktar: z.number().refine((d) => Number.isFinite(d) && d > 0, "Miktar 0'dan büyük olmalı."),
  birimFiyat: z.number().refine((d) => Number.isFinite(d) && d >= 0, "Birim fiyat geçersiz."),
  kdvOrani: z
    .number()
    .refine((d) => Number.isFinite(d) && d >= 0 && d <= 100, "KDV oranı 0-100 arası olmalı.")
    .default(0),
})

/** Sepet (kalemler) formda tek bir JSON alanı olarak taşınır — dizi FormData'ya girmez. */
const kalemlerAlani = z
  .string()
  .trim()
  .transform((d, ctx) => {
    try {
      return JSON.parse(d) as unknown
    } catch {
      ctx.addIssue({ code: "custom", message: "Sepet okunamadı." })
      return z.NEVER
    }
  })
  .pipe(z.array(kalemSemasi).min(1, "Sepette en az bir satır olmalı."))

const kimlik = (alanAdi: string) =>
  z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : Number(d)))
    .optional()
    .refine((d) => d === undefined || (Number.isInteger(d) && d > 0), `${alanAdi} geçersiz.`)

const metin = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `En fazla ${max} karakter olabilir.`)
    .transform((d) => (d === "" ? undefined : d))
    .optional()

/**
 * `cariId` BOŞ bırakılabilir — perakende müşteri için cari seçimi zorunlu
 * değil (PROMPTLAR.md 9.3). Boşsa sunucu tarafı sabit "Perakende Müşteri"
 * carisini kullanır (`veri.ts` → `perakendeMusteriIdGetir`).
 */
export const hizliSatisSemasi = z
  .object({
    cariId: kimlik("Müşteri"),
    kalemler: kalemlerAlani,
    odemeSekli: z.enum(["NAKIT", "KREDI_KARTI", "HAVALE", "CEK", "SENET", "MAHSUP"], {
      message: "Ödeme şeklini seçin.",
    }),
    kasaId: kimlik("Kasa"),
    // Tutar formdan ALINMAZ: satış toplamının tek kaynağı sepet satırları
    // (`kalemHesapla` — kabuldeki/evraktaki formülle aynı). Tezgâh üstü
    // satışta kısmi ödeme yok, tahsilat her zaman satış toplamı kadardır.
    aciklama: metin(500),
    ...kagitVePosAlanlari,
  })
  .refine((v) => !kasaGerektirir(v.odemeSekli) || !!v.kasaId, {
    message: "Nakit / kredi kartı / havale işleminde kasa seçilmelidir.",
    path: ["kasaId"],
  })
  .refine(vadeVar, vadeHatasi)

export type HizliSatisGirdi = z.infer<typeof hizliSatisSemasi>
