import type { LogIslem } from "@/generated/prisma/enums"

/**
 * İŞLEM TÜRÜ ADLARI VE ROZET RENKLERİ
 *
 * `lib/log.ts`teki `LogIslem` enum'unun ekranda görünecek Türkçe adı ve
 * rengi tek yerde — filtre dropdown'u, rozet ve CSV hepsi buradan okur.
 */
export const LOG_ISLEM_ADLARI: Record<LogIslem, string> = {
  GIRIS: "Giriş",
  GIRIS_BASARISIZ: "Başarısız Giriş",
  CIKIS: "Çıkış",
  EKLE: "Ekle",
  GUNCELLE: "Güncelle",
  SIL: "Sil",
  GERI_AL: "Geri Al",
  YAZDIR: "Yazdır",
  DISA_AKTAR: "Dışa Aktar",
}

/** Rozet sınıfı — EKLE yeşil, GUNCELLE nötr mavi, SIL kırmızı, diğerleri gri. */
export const LOG_ISLEM_ROZET: Record<LogIslem, string> = {
  GIRIS: "bg-secondary text-muted-foreground",
  GIRIS_BASARISIZ: "bg-tehlike-yumusak text-tehlike",
  CIKIS: "bg-secondary text-muted-foreground",
  EKLE: "bg-basari-yumusak text-basari",
  GUNCELLE: "bg-bilgi-yumusak text-bilgi",
  SIL: "bg-tehlike-yumusak text-tehlike",
  GERI_AL: "bg-uyari-yumusak text-uyari",
  YAZDIR: "bg-secondary text-muted-foreground",
  DISA_AKTAR: "bg-secondary text-muted-foreground",
}
