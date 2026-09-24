-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('YONETICI', 'MUHASEBE', 'SERVIS_DANISMANI', 'USTA', 'DEPO');

-- CreateEnum
CREATE TYPE "CariTur" AS ENUM ('MUSTERI', 'TEDARIKCI', 'PERSONEL', 'DIGER');

-- CreateEnum
CREATE TYPE "CariTip" AS ENUM ('SAHIS', 'SIRKET');

-- CreateEnum
CREATE TYPE "BakiyeTur" AS ENUM ('BORC', 'ALACAK');

-- CreateEnum
CREATE TYPE "KabulDurum" AS ENUM ('ACIK', 'BEKLEMEDE', 'TAMAMLANDI', 'TESLIM_EDILDI', 'IPTAL');

-- CreateEnum
CREATE TYPE "KalemTur" AS ENUM ('PARCA', 'ISCILIK', 'DIS_HIZMET');

-- CreateEnum
CREATE TYPE "EvrakTur" AS ENUM ('SATIS', 'ALIS', 'SERVIS', 'PERAKENDE', 'IADE_SATIS', 'IADE_ALIS');

-- CreateEnum
CREATE TYPE "EvrakDurum" AS ENUM ('TASLAK', 'KESILDI', 'IPTAL');

-- CreateEnum
CREATE TYPE "StokHareketTur" AS ENUM ('GIRIS', 'CIKIS', 'DEVIR', 'SAYIM', 'TRANSFER');

-- CreateEnum
CREATE TYPE "OdemeSekli" AS ENUM ('NAKIT', 'KREDI_KARTI', 'HAVALE', 'CEK', 'SENET', 'MAHSUP');

-- CreateEnum
CREATE TYPE "TahsilatTur" AS ENUM ('TAHSILAT', 'TEDIYE');

-- CreateEnum
CREATE TYPE "CariHareketTur" AS ENUM ('ACILIS', 'EVRAK', 'KABUL', 'TAHSILAT', 'TEDIYE', 'MAHSUP');

-- CreateEnum
CREATE TYPE "TanimTur" AS ENUM ('ARAC_MARKA', 'ARAC_MODEL_UST', 'ARAC_MODEL', 'ARAC_RENK', 'ARAC_TURU', 'YAKIT_TURU', 'VITES_TURU', 'KASA_TIPI', 'ARAC_NEREDE', 'ISCILIK_BOLUMU', 'BOLGE', 'STOK_GRUP', 'URUN_GRUBU', 'URETICI', 'MASRAF', 'PROJE', 'ISTEK_TURU', 'BAKIM_SEKLI', 'KART_TURU', 'MUSTERI_SINIFI');

-- CreateEnum
CREATE TYPE "LogIslem" AS ENUM ('GIRIS', 'GIRIS_BASARISIZ', 'CIKIS', 'EKLE', 'GUNCELLE', 'SIL', 'GERI_AL', 'YAZDIR', 'DISA_AKTAR');

-- CreateEnum
CREATE TYPE "NumaratorTur" AS ENUM ('KABUL', 'SATIS_FATURA', 'ALIS_FATURA', 'SERVIS_FATURA', 'PERAKENDE', 'TAHSILAT', 'TEDIYE', 'TEKLIF', 'SIPARIS', 'CARI_KOD', 'STOK_KOD');

-- CreateTable
CREATE TABLE "firma" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "unvan" TEXT NOT NULL,
    "vergiNo" TEXT,
    "vergiDair" TEXT,
    "adres" TEXT,
    "il" TEXT,
    "ilce" TEXT,
    "telefon" TEXT,
    "gsm" TEXT,
    "email" TEXT,
    "webAdresi" TEXT,
    "logoUrl" TEXT,
    "varsayilanKdv" DECIMAL(6,2) NOT NULL DEFAULT 20,
    "paraBirimi" TEXT NOT NULL DEFAULT 'TRY',
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "firma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kullanicilar" (
    "id" SERIAL NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "soyad" TEXT,
    "email" TEXT,
    "telefon" TEXT,
    "sifreHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'SERVIS_DANISMANI',
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "hataliGirisSayisi" INTEGER NOT NULL DEFAULT 0,
    "kilitBitis" TIMESTAMP(3),
    "sonGirisTarihi" TIMESTAMP(3),
    "sonGirisIp" TEXT,
    "sifreDegisimTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,
    "silindi" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "kullanicilar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kullanici_yetkileri" (
    "id" SERIAL NOT NULL,
    "kullaniciId" INTEGER NOT NULL,
    "sayfaKodu" TEXT NOT NULL,
    "gorebilir" BOOLEAN NOT NULL DEFAULT true,
    "ekleyebilir" BOOLEAN NOT NULL DEFAULT false,
    "duzeltebilir" BOOLEAN NOT NULL DEFAULT false,
    "silebilir" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "kullanici_yetkileri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tanimlar" (
    "id" SERIAL NOT NULL,
    "tur" "TanimTur" NOT NULL,
    "kod" TEXT,
    "ad" TEXT NOT NULL,
    "ustId" INTEGER,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tanimlar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "numaratorler" (
    "id" SERIAL NOT NULL,
    "tur" "NumaratorTur" NOT NULL,
    "onEk" TEXT NOT NULL DEFAULT '',
    "yil" INTEGER,
    "sonNo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "numaratorler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cariler" (
    "id" SERIAL NOT NULL,
    "kod" TEXT NOT NULL,
    "unvan" TEXT NOT NULL,
    "turu" "CariTur" NOT NULL DEFAULT 'MUSTERI',
    "tipi" "CariTip" NOT NULL DEFAULT 'SAHIS',
    "vergiNo" TEXT,
    "vergiDair" TEXT,
    "yetkili" TEXT,
    "yetkiliTelefon" TEXT,
    "telefon" TEXT,
    "gsm" TEXT,
    "email" TEXT,
    "adres" TEXT,
    "il" TEXT,
    "ilce" TEXT,
    "banka" TEXT,
    "bankaSube" TEXT,
    "hesapNo" TEXT,
    "ibanNo" TEXT,
    "paraBirimi" TEXT NOT NULL DEFAULT 'TRY',
    "stokIndirimi" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "hizmetIndirimi" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "hesapLimiti" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "riskLimiti" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vadeGun" INTEGER NOT NULL DEFAULT 0,
    "fiyatKademesi" INTEGER NOT NULL DEFAULT 0,
    "ozelKod" TEXT,
    "bolgeId" INTEGER,
    "musteriSinifi" TEXT,
    "plasiyerId" INTEGER,
    "notu" TEXT,
    "acilisBakiye" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "acilisTuru" "BakiyeTur" NOT NULL DEFAULT 'BORC',
    "bakiye" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "karaListe" BOOLEAN NOT NULL DEFAULT false,
    "karaListeNedeni" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,
    "olusturanId" INTEGER,
    "guncelleyenId" INTEGER,
    "silindi" BOOLEAN NOT NULL DEFAULT false,
    "silmeTarihi" TIMESTAMP(3),

    CONSTRAINT "cariler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "araclar" (
    "id" SERIAL NOT NULL,
    "cariId" INTEGER,
    "plaka" TEXT NOT NULL,
    "saseNo" TEXT,
    "motorNo" TEXT,
    "aracTuru" TEXT,
    "marka" TEXT,
    "modelUst" TEXT,
    "model" TEXT,
    "modelYili" INTEGER,
    "renk" TEXT,
    "yakitTuru" TEXT,
    "vitesTuru" TEXT,
    "vitesSayisi" INTEGER,
    "kasaTipi" TEXT,
    "hacimCc" INTEGER,
    "motorKw" INTEGER,
    "beygirGucu" INTEGER,
    "sonKm" INTEGER,
    "projesi" TEXT,
    "aracVersiyon" TEXT,
    "ruhsatTarihi" TIMESTAMP(3),
    "ruhsatSeriNo" TEXT,
    "trafikSigBaslama" TIMESTAMP(3),
    "trafikSigBitis" TIMESTAMP(3),
    "kaskoBaslama" TIMESTAMP(3),
    "kaskoBitis" TIMESTAMP(3),
    "garantiBaslangic" TIMESTAMP(3),
    "garantiBitis" TIMESTAMP(3),
    "muayeneBitis" TIMESTAMP(3),
    "akuBaslama" TIMESTAMP(3),
    "akuBitis" TIMESTAMP(3),
    "akuMarka" TEXT,
    "lpgTankSonTarih" TIMESTAMP(3),
    "lpgTankMarka" TEXT,
    "sonrakiBakimTarih" TIMESTAMP(3),
    "sonrakiBakimKm" INTEGER,
    "trigerDegisimKm" INTEGER,
    "trigerDegisimTarih" TIMESTAMP(3),
    "notlar" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,
    "olusturanId" INTEGER,
    "guncelleyenId" INTEGER,
    "silindi" BOOLEAN NOT NULL DEFAULT false,
    "silmeTarihi" TIMESTAMP(3),

    CONSTRAINT "araclar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kabuller" (
    "id" SERIAL NOT NULL,
    "kabulNo" TEXT NOT NULL,
    "kabulOzelNo" TEXT,
    "kartTuru" TEXT,
    "durum" "KabulDurum" NOT NULL DEFAULT 'ACIK',
    "cariId" INTEGER NOT NULL,
    "aracId" INTEGER NOT NULL,
    "girisTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "girisKm" INTEGER,
    "yakitDurumu" TEXT,
    "sarjDurumu" TEXT,
    "tahminiTeslimTarihi" TIMESTAMP(3),
    "teslimTarihi" TIMESTAMP(3),
    "getiren" TEXT,
    "getirenGsm" TEXT,
    "getirenTelefon" TEXT,
    "teslimAlacak" TEXT,
    "teslimAlacakGsm" TEXT,
    "yonlendiren" TEXT,
    "formenId" INTEGER,
    "sikayet" TEXT,
    "yapilanIsler" TEXT,
    "istekTuru" TEXT,
    "bakimSekli" TEXT,
    "aracNerede" TEXT,
    "projesi" TEXT,
    "filoSirketi" TEXT,
    "ozelEsya" TEXT,
    "aracNotlari" TEXT,
    "cariNotu" TEXT,
    "sonrakiGelisTarihi" TIMESTAMP(3),
    "sonrakiGelisKm" INTEGER,
    "tahminiTutar" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "parcaToplam" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "iscilikToplam" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "indirimToplam" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "araToplam" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "kdvToplam" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "genelToplam" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "kdvDahilGirilir" BOOLEAN NOT NULL DEFAULT false,
    "faturaKesildi" BOOLEAN NOT NULL DEFAULT false,
    "odendi" BOOLEAN NOT NULL DEFAULT false,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,
    "olusturanId" INTEGER,
    "guncelleyenId" INTEGER,
    "silindi" BOOLEAN NOT NULL DEFAULT false,
    "silmeTarihi" TIMESTAMP(3),

    CONSTRAINT "kabuller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kabul_kalemleri" (
    "id" SERIAL NOT NULL,
    "kabulId" INTEGER NOT NULL,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "tur" "KalemTur" NOT NULL,
    "stokId" INTEGER,
    "iscilikId" INTEGER,
    "aciklama" TEXT NOT NULL,
    "miktar" DECIMAL(18,3) NOT NULL DEFAULT 1,
    "birim" TEXT NOT NULL DEFAULT 'ADET',
    "birimFiyat" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "indirimOran" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "kdvOrani" DECIMAL(6,2) NOT NULL DEFAULT 20,
    "tutar" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "kdvTutar" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "toplam" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "personelId" INTEGER,
    "garantili" BOOLEAN NOT NULL DEFAULT false,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kabul_kalemleri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iscilikler" (
    "id" SERIAL NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "bolumId" INTEGER,
    "sure" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "fiyat" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "kdvOrani" DECIMAL(6,2) NOT NULL DEFAULT 20,
    "aciklama" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,
    "silindi" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "iscilikler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depolar" (
    "id" SERIAL NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "adres" TEXT,
    "varsayilan" BOOLEAN NOT NULL DEFAULT false,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "depolar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stoklar" (
    "id" SERIAL NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "barkod" TEXT,
    "ureticiKodu" TEXT,
    "uretici" TEXT,
    "orijinalKodu" TEXT,
    "muadilNo" TEXT,
    "ozelNo" TEXT,
    "tipi" TEXT,
    "grupKodu" TEXT,
    "urunGrubu" TEXT,
    "gtipNo" TEXT,
    "birim" TEXT NOT NULL DEFAULT 'ADET',
    "mevcutMiktar" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "minSeviye" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "maxSeviye" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "depoId" INTEGER,
    "rafYeri" TEXT,
    "alisFiyat" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "satisFiyat" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "ortalamaMaliyet" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "kdvOrani" DECIMAL(6,2) NOT NULL DEFAULT 20,
    "paraBirimi" TEXT NOT NULL DEFAULT 'TRY',
    "ozelFiyat1" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "ozelFiyat2" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "ozelFiyat3" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "ozelFiyat4" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "ozelFiyat5" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "desen" TEXT,
    "mevsim" TEXT,
    "hizYuk" TEXT,
    "yakitDirenci" TEXT,
    "gurultuSeviyesi" TEXT,
    "gurultuSinifi" TEXT,
    "resimUrl" TEXT,
    "teknikBilgi" TEXT,
    "aciklama" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,
    "olusturanId" INTEGER,
    "guncelleyenId" INTEGER,
    "silindi" BOOLEAN NOT NULL DEFAULT false,
    "silmeTarihi" TIMESTAMP(3),

    CONSTRAINT "stoklar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stok_hareketleri" (
    "id" SERIAL NOT NULL,
    "stokId" INTEGER NOT NULL,
    "depoId" INTEGER,
    "tur" "StokHareketTur" NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "miktar" DECIMAL(18,3) NOT NULL,
    "birimFiyat" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "tutar" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "evrakId" INTEGER,
    "kabulId" INTEGER,
    "aciklama" TEXT,
    "kullaniciId" INTEGER,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stok_hareketleri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evraklar" (
    "id" SERIAL NOT NULL,
    "evrakNo" TEXT NOT NULL,
    "tur" "EvrakTur" NOT NULL,
    "durum" "EvrakDurum" NOT NULL DEFAULT 'TASLAK',
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vadeTarihi" TIMESTAMP(3),
    "cariId" INTEGER NOT NULL,
    "kabulId" INTEGER,
    "aciklama" TEXT,
    "paraBirimi" TEXT NOT NULL DEFAULT 'TRY',
    "kur" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "araToplam" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "indirimToplam" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "kdvToplam" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "genelToplam" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "eFaturaMi" BOOLEAN NOT NULL DEFAULT false,
    "eFaturaUuid" TEXT,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,
    "olusturanId" INTEGER,
    "guncelleyenId" INTEGER,
    "silindi" BOOLEAN NOT NULL DEFAULT false,
    "silmeTarihi" TIMESTAMP(3),

    CONSTRAINT "evraklar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evrak_kalemleri" (
    "id" SERIAL NOT NULL,
    "evrakId" INTEGER NOT NULL,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "stokId" INTEGER,
    "aciklama" TEXT NOT NULL,
    "miktar" DECIMAL(18,3) NOT NULL DEFAULT 1,
    "birim" TEXT NOT NULL DEFAULT 'ADET',
    "birimFiyat" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "indirimOran" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "kdvOrani" DECIMAL(6,2) NOT NULL DEFAULT 20,
    "tutar" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "kdvTutar" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "toplam" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "evrak_kalemleri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tahsilatlar" (
    "id" SERIAL NOT NULL,
    "cariId" INTEGER NOT NULL,
    "fisNo" TEXT NOT NULL,
    "tur" "TahsilatTur" NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tutar" DECIMAL(18,2) NOT NULL,
    "odemeSekli" "OdemeSekli" NOT NULL DEFAULT 'NAKIT',
    "kasaBanka" TEXT,
    "aciklama" TEXT,
    "evrakId" INTEGER,
    "kabulId" INTEGER,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "olusturanId" INTEGER,
    "silindi" BOOLEAN NOT NULL DEFAULT false,
    "silmeTarihi" TIMESTAMP(3),

    CONSTRAINT "tahsilatlar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cari_hareketleri" (
    "id" SERIAL NOT NULL,
    "cariId" INTEGER NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tur" "CariHareketTur" NOT NULL,
    "borc" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "alacak" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "aciklama" TEXT,
    "vadeTarihi" TIMESTAMP(3),
    "evrakId" INTEGER,
    "tahsilatId" INTEGER,
    "kabulId" INTEGER,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "olusturanId" INTEGER,
    "silindi" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cari_hareketleri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "islem_loglari" (
    "id" SERIAL NOT NULL,
    "kullaniciId" INTEGER,
    "kullaniciKod" TEXT,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "islem" "LogIslem" NOT NULL,
    "tablo" TEXT,
    "kayitId" INTEGER,
    "aciklama" TEXT,
    "eskiDeger" JSONB,
    "yeniDeger" JSONB,
    "ip" TEXT,
    "tarayici" TEXT,

    CONSTRAINT "islem_loglari_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kullanicilar_kod_key" ON "kullanicilar"("kod");

-- CreateIndex
CREATE INDEX "kullanicilar_aktif_idx" ON "kullanicilar"("aktif");

-- CreateIndex
CREATE UNIQUE INDEX "kullanici_yetkileri_kullaniciId_sayfaKodu_key" ON "kullanici_yetkileri"("kullaniciId", "sayfaKodu");

-- CreateIndex
CREATE INDEX "tanimlar_tur_aktif_idx" ON "tanimlar"("tur", "aktif");

-- CreateIndex
CREATE UNIQUE INDEX "tanimlar_tur_ad_ustId_key" ON "tanimlar"("tur", "ad", "ustId");

-- CreateIndex
CREATE UNIQUE INDEX "numaratorler_tur_yil_key" ON "numaratorler"("tur", "yil");

-- CreateIndex
CREATE UNIQUE INDEX "cariler_kod_key" ON "cariler"("kod");

-- CreateIndex
CREATE INDEX "cariler_unvan_idx" ON "cariler"("unvan");

-- CreateIndex
CREATE INDEX "cariler_turu_silindi_idx" ON "cariler"("turu", "silindi");

-- CreateIndex
CREATE INDEX "cariler_vergiNo_idx" ON "cariler"("vergiNo");

-- CreateIndex
CREATE UNIQUE INDEX "araclar_plaka_key" ON "araclar"("plaka");

-- CreateIndex
CREATE INDEX "araclar_saseNo_idx" ON "araclar"("saseNo");

-- CreateIndex
CREATE INDEX "araclar_cariId_idx" ON "araclar"("cariId");

-- CreateIndex
CREATE UNIQUE INDEX "kabuller_kabulNo_key" ON "kabuller"("kabulNo");

-- CreateIndex
CREATE INDEX "kabuller_durum_silindi_idx" ON "kabuller"("durum", "silindi");

-- CreateIndex
CREATE INDEX "kabuller_girisTarihi_idx" ON "kabuller"("girisTarihi");

-- CreateIndex
CREATE INDEX "kabuller_aracId_idx" ON "kabuller"("aracId");

-- CreateIndex
CREATE INDEX "kabuller_cariId_idx" ON "kabuller"("cariId");

-- CreateIndex
CREATE INDEX "kabul_kalemleri_kabulId_idx" ON "kabul_kalemleri"("kabulId");

-- CreateIndex
CREATE INDEX "kabul_kalemleri_stokId_idx" ON "kabul_kalemleri"("stokId");

-- CreateIndex
CREATE UNIQUE INDEX "iscilikler_kod_key" ON "iscilikler"("kod");

-- CreateIndex
CREATE INDEX "iscilikler_ad_idx" ON "iscilikler"("ad");

-- CreateIndex
CREATE UNIQUE INDEX "depolar_kod_key" ON "depolar"("kod");

-- CreateIndex
CREATE UNIQUE INDEX "stoklar_kod_key" ON "stoklar"("kod");

-- CreateIndex
CREATE INDEX "stoklar_ad_idx" ON "stoklar"("ad");

-- CreateIndex
CREATE INDEX "stoklar_barkod_idx" ON "stoklar"("barkod");

-- CreateIndex
CREATE INDEX "stoklar_silindi_aktif_idx" ON "stoklar"("silindi", "aktif");

-- CreateIndex
CREATE INDEX "stok_hareketleri_stokId_tarih_idx" ON "stok_hareketleri"("stokId", "tarih");

-- CreateIndex
CREATE INDEX "stok_hareketleri_tarih_idx" ON "stok_hareketleri"("tarih");

-- CreateIndex
CREATE INDEX "evraklar_tarih_idx" ON "evraklar"("tarih");

-- CreateIndex
CREATE INDEX "evraklar_cariId_idx" ON "evraklar"("cariId");

-- CreateIndex
CREATE UNIQUE INDEX "evraklar_tur_evrakNo_key" ON "evraklar"("tur", "evrakNo");

-- CreateIndex
CREATE INDEX "evrak_kalemleri_evrakId_idx" ON "evrak_kalemleri"("evrakId");

-- CreateIndex
CREATE INDEX "tahsilatlar_cariId_tarih_idx" ON "tahsilatlar"("cariId", "tarih");

-- CreateIndex
CREATE INDEX "tahsilatlar_tarih_idx" ON "tahsilatlar"("tarih");

-- CreateIndex
CREATE UNIQUE INDEX "tahsilatlar_tur_fisNo_key" ON "tahsilatlar"("tur", "fisNo");

-- CreateIndex
CREATE INDEX "cari_hareketleri_cariId_tarih_idx" ON "cari_hareketleri"("cariId", "tarih");

-- CreateIndex
CREATE INDEX "cari_hareketleri_tarih_idx" ON "cari_hareketleri"("tarih");

-- CreateIndex
CREATE INDEX "islem_loglari_tarih_idx" ON "islem_loglari"("tarih");

-- CreateIndex
CREATE INDEX "islem_loglari_kullaniciId_tarih_idx" ON "islem_loglari"("kullaniciId", "tarih");

-- CreateIndex
CREATE INDEX "islem_loglari_tablo_kayitId_idx" ON "islem_loglari"("tablo", "kayitId");

-- AddForeignKey
ALTER TABLE "kullanici_yetkileri" ADD CONSTRAINT "kullanici_yetkileri_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "kullanicilar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tanimlar" ADD CONSTRAINT "tanimlar_ustId_fkey" FOREIGN KEY ("ustId") REFERENCES "tanimlar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cariler" ADD CONSTRAINT "cariler_bolgeId_fkey" FOREIGN KEY ("bolgeId") REFERENCES "tanimlar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "araclar" ADD CONSTRAINT "araclar_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "cariler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kabuller" ADD CONSTRAINT "kabuller_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "cariler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kabuller" ADD CONSTRAINT "kabuller_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "araclar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kabuller" ADD CONSTRAINT "kabuller_formenId_fkey" FOREIGN KEY ("formenId") REFERENCES "kullanicilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kabuller" ADD CONSTRAINT "kabuller_olusturanId_fkey" FOREIGN KEY ("olusturanId") REFERENCES "kullanicilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kabul_kalemleri" ADD CONSTRAINT "kabul_kalemleri_kabulId_fkey" FOREIGN KEY ("kabulId") REFERENCES "kabuller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kabul_kalemleri" ADD CONSTRAINT "kabul_kalemleri_stokId_fkey" FOREIGN KEY ("stokId") REFERENCES "stoklar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kabul_kalemleri" ADD CONSTRAINT "kabul_kalemleri_iscilikId_fkey" FOREIGN KEY ("iscilikId") REFERENCES "iscilikler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iscilikler" ADD CONSTRAINT "iscilikler_bolumId_fkey" FOREIGN KEY ("bolumId") REFERENCES "tanimlar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stoklar" ADD CONSTRAINT "stoklar_depoId_fkey" FOREIGN KEY ("depoId") REFERENCES "depolar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stok_hareketleri" ADD CONSTRAINT "stok_hareketleri_stokId_fkey" FOREIGN KEY ("stokId") REFERENCES "stoklar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stok_hareketleri" ADD CONSTRAINT "stok_hareketleri_depoId_fkey" FOREIGN KEY ("depoId") REFERENCES "depolar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evraklar" ADD CONSTRAINT "evraklar_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "cariler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evraklar" ADD CONSTRAINT "evraklar_kabulId_fkey" FOREIGN KEY ("kabulId") REFERENCES "kabuller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evrak_kalemleri" ADD CONSTRAINT "evrak_kalemleri_evrakId_fkey" FOREIGN KEY ("evrakId") REFERENCES "evraklar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evrak_kalemleri" ADD CONSTRAINT "evrak_kalemleri_stokId_fkey" FOREIGN KEY ("stokId") REFERENCES "stoklar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tahsilatlar" ADD CONSTRAINT "tahsilatlar_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "cariler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cari_hareketleri" ADD CONSTRAINT "cari_hareketleri_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "cariler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cari_hareketleri" ADD CONSTRAINT "cari_hareketleri_evrakId_fkey" FOREIGN KEY ("evrakId") REFERENCES "evraklar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cari_hareketleri" ADD CONSTRAINT "cari_hareketleri_tahsilatId_fkey" FOREIGN KEY ("tahsilatId") REFERENCES "tahsilatlar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cari_hareketleri" ADD CONSTRAINT "cari_hareketleri_kabulId_fkey" FOREIGN KEY ("kabulId") REFERENCES "kabuller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "islem_loglari" ADD CONSTRAINT "islem_loglari_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "kullanicilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
