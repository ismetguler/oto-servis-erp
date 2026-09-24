/**
 * Markaya ait tek kaynak. Program adi degisirse SADECE burasi degisir.
 * İşletme adı 14 Eylül 2026'da "Uğur Oto" olarak güncellendi.
 * (Faturaya/rapora basılan resmi ünvan buradan DEĞİL, `Firma` tablosundan
 * gelir — Ayarlar > Firma Bilgileri ekranından düzenlenir.)
 */
export const MARKA = {
  ad: "UĞUR OTO",
  kisaAd: "UO",
  surum: "1.0.0",
  slogan: "Oto Servis Yönetim Sistemi",
  /** Giris ekraninin altinda ve raporlarin dipnotunda gorunur */
  altBilgi: "UĞUR OTO — Oto Servis Yönetim Sistemi",
} as const
