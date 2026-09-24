import type { TanimTur } from "@/generated/prisma/enums"

/**
 * TANIM TÜRLERİ — tek kaynak
 *
 * `Tanim` tablosu projede birçok basit açılır liste için ortak kullanılıyor
 * (araç markası, yakıt türü, kart türü, masraf türü...). Bu dosya hangi
 * türün Türkçe adını, hangisinin KENDİ ÖZEL ekranı olduğunu (bu yüzden
 * `/ayar/tanim`da YÖNETİLMEDİĞİNİ, sadece link verildiğini) tek yerden
 * söylüyor — adım 11.4'te `TUR_ADLARI` deseni `ROL_ADLARI`/`MODUL_ADLARI`
 * (`lib/yetki.ts`) ile aynı mantıkta buraya taşındı.
 */
export const TUR_ADLARI: Record<TanimTur, string> = {
  ARAC_MARKA: "Araç Markası",
  ARAC_MODEL_UST: "Araç Üst Modeli",
  ARAC_MODEL: "Araç Modeli",
  ARAC_RENK: "Araç Rengi",
  ARAC_TURU: "Araç Türü",
  YAKIT_TURU: "Yakıt Türü",
  VITES_TURU: "Vites Türü",
  KASA_TIPI: "Kasa Tipi (Araç)",
  ARAC_NEREDE: "Araç Nerede (Yer)",
  ISTEK_TURU: "İstek Türü",
  BAKIM_SEKLI: "Bakım Şekli",
  KART_TURU: "Kart Türü (Kabul)",
  MASRAF: "Masraf Türü",
  STOK_GRUP: "Stok Grubu",
  URUN_GRUBU: "Ürün Grubu",
  URETICI: "Üretici",
  MUSTERI_SINIFI: "Müşteri Sınıfı",
  // Kendi özel ekranı olan ikisi — burada YÖNETİLMİYOR, sadece link veriliyor.
  ISCILIK_BOLUMU: "İşçilik Bölümü",
  PROJE: "Proje",
  // Kaldırılan kavram: enum değeri DB'de duruyor (bkz. GIZLI_TUR_SETI) ama
  // hiçbir ekranda kullanılmıyor. Sadece `Record<TanimTur, string>` tipini
  // tamamlamak için burada.
  BOLGE: "Bölge (kaldırıldı)",
}

/**
 * Kendi özel ekranı OLAN türler — 4b (İşçilik Bölümleri) ve 4d (Proje)
 * adımlarında zaten birer yönetim ekranı açılmıştı. Bu adımın talimatı
 * ikinci bir yönetim ekranı açmamak; bu yüzden `/ayar/tanim` bu iki türü
 * LİSTEDE GÖSTERMİYOR, onun yerine ayrı bir "Diğer Tanım Ekranları"
 * kutusunda ilgili sayfaya link veriyor.
 */
export const OZEL_EKRANLI_TURLER: { tur: TanimTur; yol: string; aciklama: string }[] = [
  { tur: "ISCILIK_BOLUMU", yol: "/iscilik/bolum", aciklama: "İşçilik kataloğunu gruplayan bölümler" },
  { tur: "PROJE", yol: "/servis/proje", aciklama: "Kabul kartlarını gruplayan proje adları" },
]

const OZEL_TUR_SETI = new Set(OZEL_EKRANLI_TURLER.map((o) => o.tur))

/**
 * Artık hiçbir formda kullanılmayan, ekranlardan sökülmüş türler. Enum
 * değeri ve tablo verisi duruyor (migration yok) ama `/ayar/tanim` bunları
 * listelemiyor. SA-4.1: "Araç Nerede" alanı kabul formundan ve
 * `/servis/nerede` ekranından tamamen kaldırıldı. BOLGE: Cari kartındaki
 * bölge alanı tamamen kaldırıldı (bkz. `cari/tanimlar`, `cari-formu.tsx`).
 */
// STOK_GRUP: şemada var ama hiçbir formda/sütunda okunmuyor (URUN_GRUBU
// stok kartında gerçek alan; STOK_GRUP'un karşılığı yok). Yönetilmesi kafa
// karıştırıcı olduğu için ekrandan gizlendi — bir forma bağlanırsa çıkar.
const GIZLI_TUR_SETI = new Set<TanimTur>(["ARAC_NEREDE", "ARAC_MODEL_UST", "STOK_GRUP", "BOLGE"])

/** `/ayar/tanim`ın kendisinin yönettiği türler — özel ekranlı ve gizli olanlar hariç. */
export const GENEL_TANIM_TURLERI: TanimTur[] = (
  Object.keys(TUR_ADLARI) as TanimTur[]
).filter((tur) => !OZEL_TUR_SETI.has(tur) && !GIZLI_TUR_SETI.has(tur))
