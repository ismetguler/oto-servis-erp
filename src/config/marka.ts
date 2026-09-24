/**
 * Markaya ait tek kaynak. Program adi degisirse SADECE burasi degisir.
 * (Faturaya/rapora basılan resmi ünvan buradan DEĞİL, `Firma` tablosundan
 * gelir — Ayarlar > Firma Bilgileri ekranından düzenlenir.)
 */
export const MARKA = {
  ad: "SERVİS PRO",
  kisaAd: "SP",
  surum: "1.0.0",
  slogan: "Oto Servis Yönetim Sistemi",
  /** Giris ekraninin altinda ve raporlarin dipnotunda gorunur */
  altBilgi: "SERVİS PRO — Oto Servis Yönetim Sistemi",
} as const
