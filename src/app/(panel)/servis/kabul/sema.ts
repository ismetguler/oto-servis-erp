import { z } from "zod"

import { metniSayiyaCevir } from "@/lib/sayi"

/**
 * ARAÇ KABUL (İŞ EMRİ) — doğrulama kuralları
 *
 * Alanlar VERİ-MODELİ.md'deki Selpar "Araç Kabul" ekranının A bölümünden
 * (Kabul Bilgileri) birebir alındı. B (Araç) ve C (Garanti/Sigorta)
 * bölümleri araç kartına ait olduğu için burada tekrarlanmaz; kabul ekranı
 * o alanları araç kartından okur ve gerekirse geri yazar (Selpar da öyle
 * yapıyor: kabul ekranından araç bilgisi düzeltilebiliyor).
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

const kimlik = (alanAdi: string) =>
  z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : Number(d)))
    .optional()
    .refine((d) => d === undefined || Number.isInteger(d), `${alanAdi} geçersiz.`)

const zorunluKimlik = (alanAdi: string) =>
  z
    .string()
    .trim()
    .min(1, `${alanAdi} zorunlu.`)
    .transform((d) => Number(d))
    .refine((d) => Number.isInteger(d) && d > 0, `${alanAdi} geçersiz.`)

const tarihAlani = (alanAdi: string) =>
  z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : d))
    .optional()
    .refine(
      (d) => d === undefined || !Number.isNaN(Date.parse(d)),
      `${alanAdi} geçersiz tarih.`
    )

/** "14:30" biçimli saat. Tarihle birleştirilip tek DateTime'a yazılır. */
const saatAlani = (alanAdi: string) =>
  z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : d))
    .optional()
    .refine((d) => d === undefined || /^\d{2}:\d{2}$/.test(d), `${alanAdi} geçersiz saat.`)

const paraAlani = (alanAdi: string) =>
  z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : metniSayiyaCevir(d)))
    .optional()
    .refine(
      (d) => d === undefined || (Number.isFinite(d) && d >= 0),
      `${alanAdi} geçersiz.`
    )

const oranAlani = (alanAdi: string, max = 100) =>
  z
    .string()
    .trim()
    .transform((d) => (d === "" ? 0 : metniSayiyaCevir(d)))
    .refine(
      (d) => Number.isFinite(d) && d >= 0 && d <= max,
      `${alanAdi} 0 ile ${max} arasında olmalı.`
    )

export const KABUL_DURUMLARI = [
  "ACIK",
  "BEKLEMEDE",
  "TAMAMLANDI",
  "TESLIM_EDILDI",
  "IPTAL",
] as const

/** Garanti dosyasının takip durumu — Selpar'daki garanti listesi bu kırılımla süzülüyor. */
export const GARANTI_DURUMLARI = ["BEKLIYOR", "ONAYLANDI", "RED", "ODENDI"] as const

export const GARANTI_DURUM_ETIKETI: Record<(typeof GARANTI_DURUMLARI)[number], string> = {
  BEKLIYOR: "Onay Bekliyor",
  ONAYLANDI: "Onaylandı",
  RED: "Reddedildi",
  ODENDI: "Ödendi",
}

export const kabulSemasi = z.object({
  // --- kabul bilgileri ---
  kartTuru: metin(40),
  kabulOzelNo: metin(40),
  durum: z.enum(KABUL_DURUMLARI).default("ACIK"),

  cariId: zorunluKimlik("Müşteri"),
  aracId: zorunluKimlik("Araç"),

  girisTarihi: tarihAlani("Giriş tarihi"),
  girisSaati: saatAlani("Giriş saati"),
  girisKm: tamSayi(9_999_999, "Giriş km"),

  // --- kişiler ---
  // SA-4.1: yakıt/şarj durumu, motor çalışma süresi, "getiren" (araç sahibi
  // sayılıyor), teslim alacak kişi/GSM ve yönlendiren alanları kaldırıldı.
  // DB kolonları şemada duruyor (migration yok), sadece form yolu temizlendi.
  formenId: kimlik("İlgilenecek usta"),
  personelIdler: z.array(z.number().int()).default([]),

  // --- teslim ---
  tahminiTeslimTarihi: tarihAlani("Tahmini teslim tarihi"),
  tahminiTeslimSaati: saatAlani("Tahmini teslim saati"),
  teslimNotu: metin(500),

  // --- iş bilgisi ---
  sikayet: metin(2000),
  yapilanIsler: metin(2000),
  istekTuru: metin(60),
  bakimSekli: metin(60),
  projesi: metin(100),
  filoSirketi: metin(120),
  ozelEsya: metin(1000),
  aracNotlari: metin(1000),
  cariNotu: metin(1000),

  // --- periyodik bakım / triger (araç kartına da yazılır) ---
  sonrakiGelisTarihi: tarihAlani("Sonraki geliş tarihi"),
  sonrakiGelisKm: tamSayi(9_999_999, "Sonraki geliş km"),
  trigerDegisimKm: tamSayi(9_999_999, "Triger değişim km"),
  trigerDegisimTarih: tarihAlani("Triger değişim tarihi"),

  // --- garanti takibi (kart türü GARANTİ olduğunda doldurulur) ---
  garantiVerenId: kimlik("Garanti veren firma"),
  garantiDosyaNo: metin(60),
  garantiOnayNo: metin(60),
  garantiTalepTarihi: tarihAlani("Garanti talep tarihi"),
  garantiDurumu: z
    .string()
    .trim()
    .transform((d) => (d === "" ? undefined : d))
    .optional()
    .refine(
      (d) => d === undefined || (GARANTI_DURUMLARI as readonly string[]).includes(d),
      "Garanti durumu geçersiz."
    ),
  garantiTutar: paraAlani("Garanti tutarı"),
  garantiNotu: metin(1000),

  // --- tutar ---
  tahminiTutar: paraAlani("Tahmini tutar"),
  evrakKdvOrani: oranAlani("KDV oranı"),
  kdvDahilGirilir: z.coerce.boolean().default(false),
})

export type KabulGirdisi = z.infer<typeof kabulSemasi>

/** Kalem (parça / işçilik / dış hizmet) satırı. */
export const kalemSemasi = z.object({
  id: kimlik("Kalem"),
  kabulId: zorunluKimlik("Kabul"),
  tur: z.enum(["PARCA", "ISCILIK", "DIS_HIZMET"]),
  stokId: kimlik("Stok"),
  iscilikId: kimlik("İşçilik"),
  personelId: kimlik("Personel"),
  aciklama: z.string().trim().min(1, "Açıklama zorunlu.").max(300),
  birim: z
    .string()
    .trim()
    .max(20)
    .transform((d) => (d === "" ? "ADET" : d)),
  miktar: z
    .string()
    .trim()
    .transform((d) => metniSayiyaCevir(d === "" ? "1" : d))
    .refine((d) => Number.isFinite(d) && d > 0, "Miktar 0'dan büyük olmalı."),
  birimFiyat: z
    .string()
    .trim()
    .transform((d) => metniSayiyaCevir(d === "" ? "0" : d))
    .refine((d) => Number.isFinite(d) && d >= 0, "Birim fiyat geçersiz."),
  kdvOrani: oranAlani("KDV oranı"),
  garantili: z.coerce.boolean().default(false),
}).superRefine((v, ctx) => {
  // Parça/işçilik satırları katalogdan seçilmeden elle girilemez — aksi halde
  // stok hareketi yazılmaz ve tanımsız kalemler kartlara sızar.
  if (v.tur === "PARCA" && !v.stokId) {
    ctx.addIssue({ code: "custom", path: ["stokId"], message: "Parça katalogdan seçilmeli." })
  }
  if (v.tur === "ISCILIK" && !v.iscilikId) {
    ctx.addIssue({ code: "custom", path: ["iscilikId"], message: "İşçilik katalogdan seçilmeli." })
  }
})

export type KalemGirdisi = z.infer<typeof kalemSemasi>

/**
 * Tarih ve saat ayrı input'lardan gelir ama veritabanında tek DateTime var.
 * Saat boşsa günün başlangıcı değil, o anki saat kullanılır — kabul kartında
 * "saat 00:00" görmek Selpar'da da yanlış kabul ediliyor.
 */
export function tarihSaatBirlestir(
  tarih?: string,
  saat?: string,
  varsayilan?: Date
): Date | null {
  if (!tarih) return varsayilan ?? null
  const [saatKismi, dakikaKismi] = (saat ?? "").split(":")
  const d = new Date(`${tarih}T00:00:00`)
  if (saat) d.setHours(Number(saatKismi), Number(dakikaKismi), 0, 0)
  else {
    const simdi = new Date()
    d.setHours(simdi.getHours(), simdi.getMinutes(), 0, 0)
  }
  return d
}
