import {
  BarChart3,
  Car,
  ClipboardList,
  FileText,
  IdCard,
  LayoutDashboard,
  Package,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import type { Modul } from "@/lib/yetki"

/**
 * SOL MENÜ (ADIM 12.3 — sadeleştirme)
 *
 * Hedef: teknik bilmeyen bir işletmeci "nereye tıklayacağım" diye
 * düşünmeden kullanabilsin. Önceki hâlinde 13 grup / 98 bağlantı vardı ve
 * "Raporlar" tek başına 35 maddeydi; 2-3 maddelik gruplar (Teklif, Sipariş,
 * İşçilik...) ayrı ayrı duruyordu. Şimdi 9 grup var, dağılım dengeli.
 *
 * DEĞİŞMEYEN: `yol` alanlarının HİÇBİRİ değişmedi. Sadece `ad`, gruplama
 * ve sıralama değişti. Menüden çıkarılan "Yeni ..." maddelerinin sayfaları
 * duruyor; liste ekranlarındaki sağ üst "Yeni" düğmesinden açılıyorlar.
 *
 * YETKİ: Artık bir grup birden çok modül içerebiliyor (ör. "Satış / Evrak"
 * = evrak + siparis + teklif). Bu yüzden filtreleme GRUP düzeyinden BAĞLANTI
 * düzeyine indi (bkz. yan-menu.tsx): her bağlantı kendi `modul` alanıyla
 * elenir, hiç bağlantısı kalmayan grup hiç çizilmez. Eski hâlinde bağlantı
 * `modul` alanı hiç okunmuyordu — grup modülü neyse hepsi görünüyordu.
 *
 * `hazir: false` olan sayfalar menüde görünür ama tıklanamaz ("yakında").
 */

export type MenuBaglantisi = {
  ad: string
  yol: string
  modul: Modul
  hazir?: boolean
  /** Menüde sağda gösterilecek küçük sayı (açık onarım adedi gibi). */
  sayacAnahtari?: "acikOnarim" | "teslimBekleyen"
}

/**
 * Grup içinde tıklanamaz ayırıcı satır. Sadece "Raporlar" gibi uzun
 * gruplarda kullanılıyor: 36 raporu Servis / Cari-Para / Stok / Personel
 * diye ayırır ama ÜÇÜNCÜ bir açılır seviye AÇMAZ — mobil çekmecede de bir
 * ekrana varmak yine iki dokunuş.
 */
export type MenuAraBaslik = { araBaslik: string }

export type MenuOgesi = MenuBaglantisi | MenuAraBaslik

export function araBaslikMi(oge: MenuOgesi): oge is MenuAraBaslik {
  return "araBaslik" in oge
}

export type MenuGrubu = {
  ad: string
  ikon: LucideIcon
  ogeler: MenuOgesi[]
}

export const ANA_SAYFA = {
  ad: "Ana Sayfa",
  yol: "/",
  ikon: LayoutDashboard,
}

export const MENU: MenuGrubu[] = [
  {
    ad: "Servis",
    ikon: ClipboardList,
    ogeler: [
      { ad: "Araç Kabul", yol: "/servis/kabul/yeni", modul: "kabul" },
      {
        ad: "Açık Onarımlar",
        yol: "/servis/acik",
        modul: "kabul",
        sayacAnahtari: "acikOnarim",
      },
      { ad: "Önceki Onarımlar", yol: "/servis/onceki", modul: "kabul" },
      // Ekspertiz ayrı bir yetki modülü açmıyor: ekspertizi kesen kişi
      // zaten kabul kartını da kesen kişi (servis danışmanı / yönetici).
      { ad: "Ekspertiz", yol: "/servis/ekspertiz", modul: "kabul" },
      { ad: "Servise Parça Çıkışı", yol: "/servis/parca-cikis", modul: "kabul" },
      { ad: "Garanti Listesi", yol: "/servis/garanti", modul: "kabul" },
      { ad: "Onarım Tahsilatları", yol: "/servis/tahsilat?durum=yapilmayan", modul: "kabul" },
      { ad: "Bakım Paketleri", yol: "/servis/bakim-paketi", modul: "kabul" },
      { ad: "Projeler", yol: "/servis/proje", modul: "kabul" },
      { ad: "Tüm Kabuller", yol: "/servis/kabul", modul: "kabul" },
    ],
  },
  {
    ad: "Araçlar",
    ikon: Car,
    ogeler: [
      { ad: "Araç Listesi", yol: "/arac", modul: "arac" },
      { ad: "Garanti / Sigorta Takibi", yol: "/arac/takip", modul: "arac" },
    ],
  },
  {
    ad: "Cariler",
    ikon: Users,
    ogeler: [
      { ad: "Cari Listesi", yol: "/cari", modul: "cari" },
      { ad: "Cari Ekstre", yol: "/cari/ekstre", modul: "cari" },
      { ad: "Cari Devir ve Bakiye", yol: "/cari/mizan", modul: "cari" },
      { ad: "Aynı Cari İki Kez Açılmış mı", yol: "/cari/mukerrer", modul: "cari" },
      { ad: "Cari Birleştir", yol: "/cari/birlestir", modul: "cari" },
      { ad: "Cari Kara Liste", yol: "/cari/kara-liste", modul: "cari" },
    ],
  },
  {
    // Personel ayrı modül değil, cari tablosunun `turu = PERSONEL` kesiti;
    // yetkisi de bu yüzden "cari" modülüne bağlı.
    ad: "Personel",
    ikon: IdCard,
    ogeler: [
      { ad: "Personel Listesi", yol: "/personel", modul: "cari" },
      { ad: "Satış-Tahsilat Raporu", yol: "/personel/satis-tahsilat", modul: "cari" },
    ],
  },
  {
    // Kasa/Çek-Senet ile Tahsilat/Ödeme zaten aynı `tahsilat` modülüne bağlıydı
    // ve ikisi de 3-5 maddelik cılız gruplardı: tek "Para" grubunda toplandı.
    ad: "Para",
    ikon: Wallet,
    ogeler: [
      { ad: "Tahsilat Girişi", yol: "/tahsilat/yeni", modul: "tahsilat" },
      { ad: "Ödeme Girişi", yol: "/tahsilat/odeme", modul: "tahsilat" },
      { ad: "Tahsilat Listesi", yol: "/tahsilat", modul: "tahsilat" },
      { ad: "Kasalar", yol: "/kasa", modul: "tahsilat" },
      { ad: "Kasa Defteri", yol: "/kasa/defter", modul: "tahsilat" },
      { ad: "Kasalar Arası Aktarım", yol: "/kasa/virman", modul: "tahsilat" },
      { ad: "Çek / Senet Listesi", yol: "/cek-senet", modul: "tahsilat" },
      { ad: "Çek / Senet Onayı", yol: "/cek-senet/onay", modul: "tahsilat" },
    ],
  },
  {
    // Sipariş (2) + Fatura/Evrak (4) tek grupta: ikisi de aynı işin
    // ardışık adımları — siparişi al, faturasını kes.
    ad: "Satış / Evrak",
    ikon: FileText,
    ogeler: [
      { ad: "Hızlı Satış", yol: "/evrak/hizli-satis", modul: "evrak" },
      { ad: "Satış Evrakları", yol: "/evrak/satis", modul: "evrak" },
      { ad: "Alış Evrakları", yol: "/evrak/alis", modul: "evrak" },
      { ad: "Servis Faturaları", yol: "/evrak/servis", modul: "evrak" },
      { ad: "Alınan Siparişler", yol: "/siparis/alinan", modul: "siparis" },
      { ad: "Verilen Siparişler", yol: "/siparis/verilen", modul: "siparis" },
    ],
  },
  {
    // İşçilik 3 maddeyle ayrı grup olmayı hak etmiyordu; parçayla birlikte
    // "onarımda ne kullanıldı" sorusunun iki yarısı.
    ad: "Parça / İşçilik",
    ikon: Package,
    ogeler: [
      { ad: "Stok Listesi", yol: "/stok", modul: "stok" },
      { ad: "Stok Girişi", yol: "/stok/giris", modul: "stok" },
      { ad: "Stok Hareketleri", yol: "/stok/hareket", modul: "stok" },
      { ad: "Kritik Stok", yol: "/stok/minimum", modul: "stok" },
      { ad: "Sayım Fişleri", yol: "/stok/sayim", modul: "stok" },
      { ad: "Depo Transferleri", yol: "/stok/transfer", modul: "stok" },
      { ad: "İşçilik Kataloğu", yol: "/iscilik", modul: "iscilik" },
    ],
  },
  {
    ad: "Raporlar",
    ikon: BarChart3,
    ogeler: [
      { araBaslik: "Servis" },
      { ad: "Servis Gün Sonu", yol: "/rapor/gun-sonu", modul: "rapor" },
      { ad: "Günlük Özet", yol: "/rapor/icmal", modul: "rapor" },
      { ad: "Onarım Kârlılık", yol: "/rapor/karlilik", modul: "rapor" },
      { ad: "Yapılan İşçilikler", yol: "/rapor/iscilik", modul: "rapor" },
      { ad: "Yapılan Parçalar", yol: "/rapor/parca", modul: "rapor" },
      { ad: "İşçilik Toplamları", yol: "/rapor/iscilik-toplam", modul: "rapor" },
      { ad: "Servis Satış Detaylı", yol: "/rapor/satis-detay", modul: "rapor" },
      { ad: "Araç Genel Durum", yol: "/rapor/arac-genel", modul: "rapor" },
      { ad: "Servis Yıllık Analiz", yol: "/rapor/yillik-analiz", modul: "rapor" },
      { ad: "Servis Araç Analiz", yol: "/rapor/arac-analiz", modul: "rapor" },
      { ad: "Tekrar Gelen Araçlar", yol: "/rapor/geri-donus", modul: "rapor" },
      { ad: "Sigorta Ödeme", yol: "/rapor/sigorta-odeme", modul: "rapor" },
      { ad: "Dış Hizmet", yol: "/rapor/dis-hizmet", modul: "rapor" },

      { araBaslik: "Cari / Para" },
      { ad: "Cari Yaşlandırma", yol: "/rapor/yaslandirma", modul: "rapor" },
      { ad: "Cari Hareket", yol: "/rapor/cari-hareket", modul: "rapor" },
      { ad: "Cari Alış-Satış Toplamları", yol: "/rapor/hesap-toplam", modul: "rapor" },
      { ad: "Cari Alış-Satış", yol: "/rapor/cari-alis-satis", modul: "rapor" },
      { ad: "Ödemesi Geçenler", yol: "/rapor/gecen-odemeler", modul: "rapor" },
      { ad: "Aylık Borç Tahsilat", yol: "/rapor/aylik-borc-tahsilat", modul: "rapor" },
      { ad: "Cari Gün Sonu", yol: "/rapor/cari-gun-sonu", modul: "rapor" },
      { ad: "Bugün Açılan Cariler", yol: "/rapor/bugun-acilan", modul: "rapor" },
      { ad: "Aynı Vergi Nolu Cariler", yol: "/rapor/vkn-mukerrer", modul: "rapor" },
      { ad: "KDV Özeti", yol: "/rapor/kdv", modul: "rapor" },

      { araBaslik: "Stok" },
      { ad: "Stok Son Durum", yol: "/rapor/stok", modul: "rapor" },
      { ad: "Depo Envanteri", yol: "/rapor/envanter", modul: "rapor" },
      { ad: "Kritik Stok", yol: "/rapor/kritik-stok", modul: "rapor" },
      { ad: "Stok Kâr-Zarar", yol: "/rapor/stok-kar-zarar", modul: "rapor" },
      { ad: "Stok Alış-Satış", yol: "/rapor/stok-alis-satis", modul: "rapor" },
      { ad: "Stok Maliyet ve Satış", yol: "/rapor/stok-maliyet-satis", modul: "rapor" },
      { ad: "Stok Giriş-Çıkış", yol: "/rapor/giris-cikis", modul: "rapor" },
      { ad: "Stok Hareket Analizi", yol: "/rapor/stok-hareket-analiz", modul: "rapor" },
      { ad: "Hareketsiz Parçalar", yol: "/rapor/olu-stok", modul: "rapor" },
      { ad: "En Çok Kullanılan Parça", yol: "/rapor/en-cok-kullanilan", modul: "rapor" },
      { ad: "Bugün Eklenenler", yol: "/rapor/bugun-eklenen-stok", modul: "rapor" },
    ],
  },
  {
    ad: "Ayarlar",
    ikon: Settings,
    ogeler: [
      { ad: "Firma Bilgileri", yol: "/ayar/firma", modul: "ayar" },
      { ad: "Kullanıcılar", yol: "/ayar/kullanici", modul: "ayar" },
      { ad: "Listeler ve Tanımlar", yol: "/ayar/tanim", modul: "ayar" },
      { ad: "Araç Modelleri", yol: "/ayar/arac-model", modul: "ayar" },
      { ad: "Kim Ne Yaptı", yol: "/ayar/log", modul: "ayar" },
    ],
  },
]
