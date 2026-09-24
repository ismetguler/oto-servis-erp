import { z } from "zod"

import { panelKoduGecerli } from "@/config/arac-panel"
import { metniSayiyaCevir } from "@/lib/sayi"

/**
 * EKSPERTİZ (ÖN TAHMİN) — doğrulama kuralları
 *
 * Alanlar Uğur Otomotiv'in matbu "EKSPER SURETİ" formundan birebir alındı:
 * üst blok (dosya/poliçe/eksper bilgileri), donanım VAR/YOK çeklisti, parça
 * tablosu ve alttaki 10 satırlık işçilik kırılımı.
 *
 * Doğrulama kuralları bilerek GEVŞEK: ekspertiz araç başındayken, çoğu zaman
 * telefondan dolduruluyor ve bilgi parça parça geliyor (poliçe no sonra
 * geliyor, eksper adı sonra belli oluyor). Zorunlu tutulan tek şey müşteri
 * ve araç — kartın kime ve neye ait olduğu belli olmadan kayıt anlamsız.
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

/** Boş bırakılabilen para alanı — girilmezse 0. */
const paraAlani = (alanAdi: string) =>
  z
    .string()
    .trim()
    .transform((d) => (d === "" ? 0 : metniSayiyaCevir(d)))
    .refine((d) => Number.isFinite(d) && d >= 0, `${alanAdi} geçersiz.`)

const oranAlani = (alanAdi: string, max = 100) =>
  z
    .string()
    .trim()
    .transform((d) => (d === "" ? 0 : metniSayiyaCevir(d)))
    .refine(
      (d) => Number.isFinite(d) && d >= 0 && d <= max,
      `${alanAdi} 0 ile ${max} arasında olmalı.`
    )

/**
 * Donanım çeklisti kutusu — üç durumlu.
 * "" = sorulmadı, "VAR", "YOK". Üçünün ayrı durması şart: sigorta
 * ihtilafında "sorulmadı" ile "yoktu" aynı şey değil.
 */
const donanimAlani = z
  .string()
  .trim()
  .transform((d) => (d === "VAR" ? true : d === "YOK" ? false : undefined))
  .optional()

export const EKSPERTIZ_DURUMLARI = [
  "TASLAK",
  "GONDERILDI",
  "ONAYLANDI",
  "RED",
  "KABULE_DONDU",
] as const

export const EKSPERTIZ_DURUM_ETIKETI: Record<
  (typeof EKSPERTIZ_DURUMLARI)[number],
  string
> = {
  TASLAK: "Taslak",
  GONDERILDI: "Gönderildi",
  ONAYLANDI: "Onaylandı",
  RED: "Reddedildi",
  KABULE_DONDU: "Kabule Dönüştü",
}

/** Matbu formun alt bloğundaki 10 sabit işçilik satırı. */
export const ISCILIK_SATIRLARI = [
  { ad: "kaportaIscilik", etiket: "Kaporta İşçilik" },
  { ad: "boyaIscilik", etiket: "Boya İşçilik" },
  { ad: "dosemeIscilik", etiket: "Döşeme İşçilik" },
  { ad: "mekanikIscilik", etiket: "Mekanik İşçilik" },
  { ad: "hariciIscilik", etiket: "Harici İşçilik" },
  { ad: "elektrikIscilik", etiket: "Elektrik İşçilik" },
  { ad: "camciIscilik", etiket: "Camcı İşçilik" },
  { ad: "saseIscilik", etiket: "Şase İşçilik" },
  { ad: "rotBalansIscilik", etiket: "Rot - Balans" },
  { ad: "klimaGaziIscilik", etiket: "Klima Gazı" },
] as const

export type IscilikAlani = (typeof ISCILIK_SATIRLARI)[number]["ad"]

/** Matbu formun sağ üstündeki VAR / YOK çeklisti. */
export const DONANIM_SATIRLARI = [
  { ad: "immobilizer", etiket: "İmmobilizer" },
  { ad: "airbag", etiket: "Airbag" },
  { ad: "abs", etiket: "ABS" },
  { ad: "klima", etiket: "Klima" },
  { ad: "stepne", etiket: "Stepne" },
  { ad: "kriko", etiket: "Kriko" },
  { ad: "cdCalar", etiket: "Cd Çalar" },
  { ad: "lpg", etiket: "Lpg" },
  { ad: "sunroof", etiket: "Sunroof" },
] as const

export type DonanimAlani = (typeof DONANIM_SATIRLARI)[number]["ad"]

export const ekspertizSemasi = z.object({
  matbuNo: metin(20),
  durum: z.enum(EKSPERTIZ_DURUMLARI).default("TASLAK"),

  cariId: zorunluKimlik("Müşteri"),
  aracId: zorunluKimlik("Araç"),

  // --- matbu formun üst bloğu ---
  soforTc: metin(20),
  tcKimlikNo: metin(20),
  karsiAracTel: metin(30),
  karsiAracTc: metin(20),
  policeNo: metin(40),
  dosyaNo: metin(40),
  hdNo: metin(40),
  sigortaAdi: metin(120),
  eksperAdi: metin(120),

  km: tamSayi(9_999_999, "Km"),
  baslangicTarihi: tarihAlani("Başlangıç tarihi"),
  teslimTarihi: tarihAlani("Teslim tarihi"),

  // --- donanım çeklisti ---
  immobilizer: donanimAlani,
  airbag: donanimAlani,
  abs: donanimAlani,
  klima: donanimAlani,
  stepne: donanimAlani,
  kriko: donanimAlani,
  cdCalar: donanimAlani,
  lpg: donanimAlani,
  sunroof: donanimAlani,

  // --- işçilik kırılımı ---
  kaportaIscilik: paraAlani("Kaporta işçilik"),
  boyaIscilik: paraAlani("Boya işçilik"),
  dosemeIscilik: paraAlani("Döşeme işçilik"),
  mekanikIscilik: paraAlani("Mekanik işçilik"),
  hariciIscilik: paraAlani("Harici işçilik"),
  elektrikIscilik: paraAlani("Elektrik işçilik"),
  camciIscilik: paraAlani("Camcı işçilik"),
  saseIscilik: paraAlani("Şase işçilik"),
  rotBalansIscilik: paraAlani("Rot - balans"),
  klimaGaziIscilik: paraAlani("Klima gazı"),

  iscilikKdvOrani: oranAlani("İşçilik KDV oranı"),
  kdvDahilGirilir: z.coerce.boolean().default(false),

  notlar: metin(2000),
})

export type EkspertizGirdisi = z.infer<typeof ekspertizSemasi>

/**
 * Parça tablosunun satırları. Paralel diziler hâlinde gelir (stok girişi
 * fişindeki desenin aynısı): `form.getAll("kalemAciklama")` vb. Satır sırası
 * DOM sırasıdır, diziler birbiriyle hizalıdır.
 *
 * Kabul kartının aksine parça KATALOGDAN SEÇİLME ZORUNLULUĞU YOK: ekspertiz
 * bir ön tahmin, stok hareketi üretmiyor. Eksper "sol ön çamurluk" yazıp
 * geçebilmeli; parçanın stok kartı belki de henüz yok (sipariş edilecek).
 */
export const kalemlerSemasi = z
  .object({
    kalemAciklama: z.array(z.string()),
    kalemMiktar: z.array(z.string()),
    kalemBirim: z.array(z.string()),
    kalemBirimFiyat: z.array(z.string()),
    kalemKdvOrani: z.array(z.string()),
  })
  .superRefine((v, ctx) => {
    const uzunluklar = [
      v.kalemAciklama.length,
      v.kalemMiktar.length,
      v.kalemBirim.length,
      v.kalemBirimFiyat.length,
      v.kalemKdvOrani.length,
    ]
    if (new Set(uzunluklar).size !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "Parça satırları bozuk geldi; sayfayı yenileyip tekrar deneyin.",
      })
    }
  })
  .transform((v) =>
    v.kalemAciklama
      .map((aciklama, i) => ({
        aciklama: aciklama.trim(),
        miktar: metniSayiyaCevir(v.kalemMiktar[i] === "" ? "1" : v.kalemMiktar[i]),
        birim: v.kalemBirim[i]?.trim() || "ADET",
        birimFiyat: metniSayiyaCevir(
          v.kalemBirimFiyat[i] === "" ? "0" : v.kalemBirimFiyat[i]
        ),
        kdvOrani: metniSayiyaCevir(
          v.kalemKdvOrani[i] === "" ? "0" : v.kalemKdvOrani[i]
        ),
      }))
      // Boş satırlar sessizce atılır: form her zaman birkaç boş satırla
      // açılıyor, kullanıcı hepsini doldurmak zorunda değil.
      .filter((k) => k.aciklama !== "")
  )
  .superRefine((kalemler, ctx) => {
    for (const [i, k] of kalemler.entries()) {
      if (!Number.isFinite(k.miktar) || k.miktar <= 0) {
        ctx.addIssue({
          code: "custom",
          message: `${i + 1}. satırdaki miktar 0'dan büyük olmalı.`,
        })
      }
      if (!Number.isFinite(k.birimFiyat) || k.birimFiyat < 0) {
        ctx.addIssue({
          code: "custom",
          message: `${i + 1}. satırdaki birim fiyat geçersiz.`,
        })
      }
      if (!Number.isFinite(k.kdvOrani) || k.kdvOrani < 0 || k.kdvOrani > 100) {
        ctx.addIssue({
          code: "custom",
          message: `${i + 1}. satırdaki KDV oranı 0 ile 100 arasında olmalı.`,
        })
      }
    }
  })

export type KalemGirdisi = z.infer<typeof kalemlerSemasi>[number]

/**
 * Şemada işaretlenen paneller. Form `panel_<kod>` adıyla gönderiyor; burada
 * yalnızca ÇİZİMDE GERÇEKTEN VAR OLAN kodlar kabul ediliyor, aksi hâlde el
 * yapımı bir istek veritabanına hayalet panel yazabilirdi.
 */
const PANEL_DURUMLARI_KOD = ["LOKAL_BOYALI", "BOYALI", "DEGISMIS"] as const

export function panelleriOku(form: FormData) {
  const paneller: { panelKodu: string; durum: (typeof PANEL_DURUMLARI_KOD)[number] }[] =
    []

  for (const [ad, deger] of form.entries()) {
    if (!ad.startsWith("panel_")) continue
    const panelKodu = ad.slice("panel_".length)
    const durum = String(deger)
    if (!panelKoduGecerli(panelKodu)) continue
    if (!(PANEL_DURUMLARI_KOD as readonly string[]).includes(durum)) continue
    paneller.push({
      panelKodu,
      durum: durum as (typeof PANEL_DURUMLARI_KOD)[number],
    })
  }

  return paneller
}
