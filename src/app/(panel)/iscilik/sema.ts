import { z } from "zod"

import { metniSayiyaCevir } from "@/lib/sayi"

/**
 * İŞÇİLİK KATALOĞU — doğrulama kuralları
 *
 * Selpar'daki "Tanımlamalar > İşçilik Kataloğu" ekranının alanları:
 * Kod, İşçilik Adı, Bölüm, Süre (saat), Birim Fiyat, KDV, Açıklama, Aktif.
 * Araç/Cari şemalarındaki desenin aynısı — tek kaynak, hem sunucu hem tarayıcı.
 */

const metin = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `En fazla ${max} karakter olabilir.`)
    .transform((d) => (d === "" ? undefined : d))
    .optional()

/**
 * Para/süre alanı. Kullanıcı Türkçe klavyeyle "1.250,50" da yazabilir;
 * ondalık ayırıcıyı burada normalleştiriyoruz — form tarafında yapılsaydı
 * sunucuya doğrudan gönderilen istekte aynı temizlik yapılmamış olurdu.
 */
const ondalik = (max: number, alanAdi: string) =>
  z
    .string()
    .trim()
    .transform((d) => (d === "" ? 0 : metniSayiyaCevir(d)))
    .refine(
      (d) => Number.isFinite(d) && d >= 0 && d <= max,
      `${alanAdi} geçersiz.`
    )

export const iscilikSemasi = z.object({
  // Boş bırakılırsa numaratörden üretilir (cari kodundaki mantık).
  kod: metin(30),
  ad: z.string().trim().min(2, "İşçilik adı zorunlu.").max(200, "İşçilik adı çok uzun."),
  bolumId: z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : Number(d)))
    .optional()
    .refine((d) => d === undefined || Number.isInteger(d), "Bölüm geçersiz."),
  sure: ondalik(9999, "Süre"),
  fiyat: ondalik(9_999_999, "Birim fiyat"),
  kdvOrani: ondalik(100, "KDV oranı"),
  aciklama: metin(1000),
  aktif: z.coerce.boolean().default(true),
})

export type IscilikGirdisi = z.infer<typeof iscilikSemasi>

/** İşçilik bölümü (Tanim, tur = ISCILIK_BOLUMU) — küçük tek alanlı form. */
export const bolumSemasi = z.object({
  ad: z.string().trim().min(2, "Bölüm adı zorunlu.").max(100, "Bölüm adı çok uzun."),
  kod: metin(20),
  sira: z
    .string()
    .trim()
    .transform((d) => (d === "" ? 0 : Number(d)))
    .refine((d) => Number.isInteger(d) && d >= 0 && d <= 9999, "Sıra geçersiz."),
})
