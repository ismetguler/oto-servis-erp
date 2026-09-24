-- CreateEnum
CREATE TYPE "EkspertizDurum" AS ENUM ('TASLAK', 'GONDERILDI', 'ONAYLANDI', 'RED', 'KABULE_DONDU');

-- CreateEnum
CREATE TYPE "EkspertizSema" AS ENUM ('BINEK', 'TICARI');

-- CreateEnum
CREATE TYPE "PanelDurum" AS ENUM ('LOKAL_BOYALI', 'BOYALI', 'DEGISMIS', 'HASARLI');

-- AlterEnum
ALTER TYPE "NumaratorTur" ADD VALUE 'EKSPERTIZ';

-- DropEnum
-- NOT: MesaiTur, mesai/komisyon adiminda sokulmustu ama enum tipi
-- veritabaninda oksuz kalmisti. Hicbir sutun kullanmiyor (kontrol edildi),
-- bu migration artigi da temizliyor.
DROP TYPE "MesaiTur";

-- CreateTable
CREATE TABLE "ekspertizler" (
    "id" SERIAL NOT NULL,
    "ekspertizNo" TEXT NOT NULL,
    "matbuNo" TEXT,
    "durum" "EkspertizDurum" NOT NULL DEFAULT 'TASLAK',
    "cariId" INTEGER NOT NULL,
    "aracId" INTEGER NOT NULL,
    "soforTc" TEXT,
    "tcKimlikNo" TEXT,
    "karsiAracTel" TEXT,
    "karsiAracTc" TEXT,
    "policeNo" TEXT,
    "dosyaNo" TEXT,
    "hdNo" TEXT,
    "sigortaAdi" TEXT,
    "eksperAdi" TEXT,
    "km" INTEGER,
    "baslangicTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teslimTarihi" TIMESTAMP(3),
    "immobilizer" BOOLEAN,
    "airbag" BOOLEAN,
    "abs" BOOLEAN,
    "klima" BOOLEAN,
    "stepne" BOOLEAN,
    "kriko" BOOLEAN,
    "cdCalar" BOOLEAN,
    "lpg" BOOLEAN,
    "sunroof" BOOLEAN,
    "kaportaIscilik" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "boyaIscilik" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "dosemeIscilik" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "mekanikIscilik" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "hariciIscilik" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "elektrikIscilik" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "camciIscilik" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "saseIscilik" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "rotBalansIscilik" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "klimaGaziIscilik" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "iscilikKdvOrani" DECIMAL(6,2) NOT NULL DEFAULT 20,
    "kdvDahilGirilir" BOOLEAN NOT NULL DEFAULT false,
    "parcaToplam" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "iscilikToplam" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "araToplam" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "kdvToplam" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "genelToplam" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "semaTuru" "EkspertizSema" NOT NULL DEFAULT 'BINEK',
    "notlar" TEXT,
    "kabulId" INTEGER,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,
    "olusturanId" INTEGER,
    "guncelleyenId" INTEGER,
    "silindi" BOOLEAN NOT NULL DEFAULT false,
    "silmeTarihi" TIMESTAMP(3),

    CONSTRAINT "ekspertizler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ekspertiz_kalemleri" (
    "id" SERIAL NOT NULL,
    "ekspertizId" INTEGER NOT NULL,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "stokId" INTEGER,
    "aciklama" TEXT NOT NULL,
    "miktar" DECIMAL(18,3) NOT NULL DEFAULT 1,
    "birim" TEXT NOT NULL DEFAULT 'ADET',
    "birimFiyat" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "kdvOrani" DECIMAL(6,2) NOT NULL DEFAULT 20,
    "tutar" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "kdvTutar" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "toplam" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "ekspertiz_kalemleri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ekspertiz_panelleri" (
    "id" SERIAL NOT NULL,
    "ekspertizId" INTEGER NOT NULL,
    "panelKodu" TEXT NOT NULL,
    "durum" "PanelDurum" NOT NULL,
    "not" TEXT,

    CONSTRAINT "ekspertiz_panelleri_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ekspertizler_ekspertizNo_key" ON "ekspertizler"("ekspertizNo");

-- CreateIndex
CREATE INDEX "ekspertizler_durum_silindi_idx" ON "ekspertizler"("durum", "silindi");

-- CreateIndex
CREATE INDEX "ekspertizler_baslangicTarihi_idx" ON "ekspertizler"("baslangicTarihi");

-- CreateIndex
CREATE INDEX "ekspertizler_aracId_idx" ON "ekspertizler"("aracId");

-- CreateIndex
CREATE INDEX "ekspertizler_cariId_idx" ON "ekspertizler"("cariId");

-- CreateIndex
CREATE INDEX "ekspertizler_dosyaNo_idx" ON "ekspertizler"("dosyaNo");

-- CreateIndex
CREATE INDEX "ekspertiz_kalemleri_ekspertizId_idx" ON "ekspertiz_kalemleri"("ekspertizId");

-- CreateIndex
CREATE UNIQUE INDEX "ekspertiz_panelleri_ekspertizId_panelKodu_key" ON "ekspertiz_panelleri"("ekspertizId", "panelKodu");

-- AddForeignKey
ALTER TABLE "ekspertizler" ADD CONSTRAINT "ekspertizler_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "cariler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ekspertizler" ADD CONSTRAINT "ekspertizler_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "araclar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ekspertizler" ADD CONSTRAINT "ekspertizler_kabulId_fkey" FOREIGN KEY ("kabulId") REFERENCES "kabuller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ekspertiz_kalemleri" ADD CONSTRAINT "ekspertiz_kalemleri_ekspertizId_fkey" FOREIGN KEY ("ekspertizId") REFERENCES "ekspertizler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ekspertiz_kalemleri" ADD CONSTRAINT "ekspertiz_kalemleri_stokId_fkey" FOREIGN KEY ("stokId") REFERENCES "stoklar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ekspertiz_panelleri" ADD CONSTRAINT "ekspertiz_panelleri_ekspertizId_fkey" FOREIGN KEY ("ekspertizId") REFERENCES "ekspertizler"("id") ON DELETE CASCADE ON UPDATE CASCADE;
