import { z } from "zod"

/**
 * FİRMA BİLGİLERİ — doğrulama kuralları
 *
 * Tek satırlık tablo (`Firma.id` hep 1) olduğu için tek şema yeter — ekleme/
 * düzenleme ayrımı yok, `kullanici/sema.ts`teki gibi iki ayrı şema açmaya
 * gerek görülmedi.
 */

const bosSaTemizle = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `En fazla ${max} karakter olabilir.`)
    .transform((d) => (d === "" ? undefined : d))
    .optional()

export const firmaSemasi = z.object({
  unvan: z.string().trim().min(2, "Ünvan en az 2 karakter olmalı.").max(200, "Ünvan çok uzun."),
  vergiNo: bosSaTemizle(20),
  vergiDair: bosSaTemizle(100),
  adres: bosSaTemizle(500),
  il: bosSaTemizle(60),
  ilce: bosSaTemizle(60),
  telefon: bosSaTemizle(30),
  gsm: bosSaTemizle(30),
  email: z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : d))
    .optional()
    .refine(
      (d) => d === undefined || z.email().safeParse(d).success,
      "Geçerli bir e-posta adresi yazın."
    ),
  webAdresi: bosSaTemizle(200),
  // Fatura altında gösterilecek banka/IBAN (adım 11.8) — Cari'deki banka
  // alanlarıyla aynı desen, ayrı amaç: bu firmanın kendi hesabı.
  bankaAdi: bosSaTemizle(150),
  ibanNo: bosSaTemizle(40),
  // Baskı şablonları (fatura/rapor başlığı) logosu. Ya dışarıda barındırılan
  // bir URL (kısa) ya da tarayıcıda küçültülüp yüklenen `data:image/...` URI
  // (büyük) — ikisi de aynı metin sütununda durur, `<Image unoptimized>` ile
  // basılır.
  logoUrl: z
    .string()
    .trim()
    .max(500_000, "Logo dosyası çok büyük — daha küçük bir görsel seçin.")
    .transform((d) => (d === "" ? undefined : d))
    .optional(),
  // Sol menü + giriş ekranı için YÜKLENEN logo: tarayıcıda ~160px'e
  // küçültülüp base64 data URI olarak gelir, DB'de metin sütununda durur.
  // (Dosya yükleme servisi yok — Vercel'de kalıcı disk yok.)
  logo: z
    .string()
    .trim()
    .max(400_000, "Logo dosyası çok büyük — daha küçük bir görsel seçin.")
    .refine(
      (d) => d === "" || d.startsWith("data:image/"),
      "Geçersiz logo verisi."
    )
    .transform((d) => (d === "" ? undefined : d))
    .optional(),
  // Metin olarak gelir (virgüllü/noktalı) — `metniSayiyaCevir` ile sayıya
  // çevrildikten SONRA bu şemaya değil doğrudan Decimal'e yazılıyor, bu
  // yüzden burada sayı değil ham metin doğrulanıyor.
  varsayilanKdv: z
    .string()
    .trim()
    .min(1, "Varsayılan KDV oranı zorunlu."),
  paraBirimi: z.enum(["TRY", "USD", "EUR"]),
})

export type FirmaGirdisi = z.infer<typeof firmaSemasi>
