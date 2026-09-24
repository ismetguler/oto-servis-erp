import type { Rol } from "@/generated/prisma/enums"

/**
 * YETKİ SİSTEMİ
 *
 * İki katmanlıdır (Selpar'daki SayfaId mantığının sadeleştirilmiş hâli):
 *   1. ROL      — kullanıcının rolü modüle varsayılan erişimi belirler.
 *   2. İSTİSNA  — `kullanici_yetkileri` tablosunda kayıt varsa rolü EZER.
 *
 * Böylece "bu usta stok da girebilsin" gibi tek kişilik istekler,
 * yeni rol açmadan karşılanır.
 */

export const MODULLER = [
  "kabul", // araç kabul / iş emri
  "arac", // araç kartları
  "cari", // müşteri / tedarikçi / personel
  "tahsilat", // tahsilat ve tediye
  "stok", // parça / depo
  "iscilik", // işçilik kataloğu
  "evrak", // fatura / irsaliye
  "siparis", // alınan / verilen sipariş
  "rapor", // raporlar
  "ayar", // firma bilgileri, kullanıcılar, tanımlar, log
] as const

export type Modul = (typeof MODULLER)[number]
export type Islem = "gor" | "ekle" | "duzelt" | "sil"

const TAM: Islem[] = ["gor", "ekle", "duzelt", "sil"]
const SADECE_GOR: Islem[] = ["gor"]

/** Rol bazlı varsayılan yetkiler. Listede olmayan modüle erişim yoktur. */
export const ROL_MATRISI: Record<Rol, Partial<Record<Modul, Islem[]>>> = {
  YONETICI: {
    kabul: TAM,
    arac: TAM,
    cari: TAM,
    tahsilat: TAM,
    stok: TAM,
    iscilik: TAM,
    evrak: TAM,
    siparis: TAM,
    rapor: TAM,
    ayar: TAM,
  },
  MUHASEBE: {
    kabul: SADECE_GOR,
    arac: SADECE_GOR,
    cari: TAM,
    tahsilat: TAM,
    stok: SADECE_GOR,
    iscilik: SADECE_GOR,
    evrak: TAM,
    siparis: TAM,
    rapor: SADECE_GOR,
  },
  SERVIS_DANISMANI: {
    kabul: TAM,
    arac: TAM,
    cari: ["gor", "ekle", "duzelt"],
    tahsilat: ["gor", "ekle"],
    stok: SADECE_GOR,
    iscilik: SADECE_GOR,
    evrak: ["gor", "ekle"],
    siparis: ["gor", "ekle", "duzelt"],
    rapor: SADECE_GOR,
  },
  USTA: {
    kabul: ["gor", "duzelt"],
    arac: SADECE_GOR,
    stok: SADECE_GOR,
    iscilik: SADECE_GOR,
  },
  DEPO: {
    kabul: SADECE_GOR,
    arac: SADECE_GOR,
    stok: TAM,
    evrak: ["gor", "ekle"],
    siparis: SADECE_GOR,
    rapor: SADECE_GOR,
  },
}

/** Kullanıcıya özel istisna yetkiler (veritabanından gelir). */
export type YetkiIstisnasi = {
  sayfaKodu: string
  gorebilir: boolean
  ekleyebilir: boolean
  duzeltebilir: boolean
  silebilir: boolean
}

export type YetkiSahibi = {
  rol: Rol
  istisnalar?: YetkiIstisnasi[]
}

/** Bir kullanıcının ilgili modülde ilgili işlemi yapıp yapamayacağını söyler. */
export function yetkiVar(
  kullanici: YetkiSahibi,
  modul: Modul,
  islem: Islem = "gor"
): boolean {
  const istisna = kullanici.istisnalar?.find((y) => y.sayfaKodu === modul)
  if (istisna) {
    switch (islem) {
      case "gor":
        return istisna.gorebilir
      case "ekle":
        return istisna.ekleyebilir
      case "duzelt":
        return istisna.duzeltebilir
      case "sil":
        return istisna.silebilir
    }
  }
  return ROL_MATRISI[kullanici.rol]?.[modul]?.includes(islem) ?? false
}

/** Yetkisiz erişimde fırlatılır; üst katman 403 döner. */
export class YetkiHatasi extends Error {
  constructor(modul: Modul, islem: Islem) {
    super(`Bu işlem için yetkiniz yok (${modul}.${islem}).`)
    this.name = "YetkiHatasi"
  }
}

/** Yetki yoksa hata fırlatır. Sunucu tarafı işlemlerinin başında çağrılır. */
export function yetkiZorunlu(
  kullanici: YetkiSahibi,
  modul: Modul,
  islem: Islem = "gor"
): void {
  if (!yetkiVar(kullanici, modul, islem)) throw new YetkiHatasi(modul, islem)
}

/** Modül kodlarının ekranda gösterilecek Türkçe adı (istisna paneli, loglar). */
export const MODUL_ADLARI: Record<Modul, string> = {
  kabul: "Araç Kabul",
  arac: "Araç",
  cari: "Cari",
  tahsilat: "Tahsilat",
  stok: "Stok",
  iscilik: "İşçilik",
  evrak: "Evrak",
  siparis: "Sipariş",
  rapor: "Rapor",
  ayar: "Ayarlar",
}

export const ROL_ADLARI: Record<Rol, string> = {
  YONETICI: "Yönetici",
  MUHASEBE: "Muhasebe",
  SERVIS_DANISMANI: "Servis Danışmanı",
  USTA: "Usta",
  DEPO: "Depo",
}
