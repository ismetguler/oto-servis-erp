-- CreateEnum
CREATE TYPE "KasaTur" AS ENUM ('NAKIT', 'BANKA', 'POS');

-- CreateEnum
CREATE TYPE "KasaHareketTur" AS ENUM ('ACILIS', 'GIRIS', 'CIKIS', 'VIRMAN_GIRIS', 'VIRMAN_CIKIS');

-- CreateEnum
CREATE TYPE "CekSenetTur" AS ENUM ('CEK', 'SENET');

-- CreateEnum
CREATE TYPE "CekSenetYon" AS ENUM ('ALINAN', 'VERILEN');

-- CreateEnum
CREATE TYPE "CekSenetDurum" AS ENUM ('PORTFOYDE', 'TAHSILDE', 'TAHSIL_EDILDI', 'ODENDI', 'KARSILIKSIZ', 'CIRO_EDILDI', 'IADE_EDILDI');

-- CreateEnum
CREATE TYPE "OnayDurum" AS ENUM ('BEKLIYOR', 'ONAYLANDI', 'REDDEDILDI');

-- AlterEnum
ALTER TYPE "CariHareketTur" ADD VALUE 'CEK_SENET';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NumaratorTur" ADD VALUE 'KASA_KOD';
ALTER TYPE "NumaratorTur" ADD VALUE 'CEK_SENET';

-- AlterTable
ALTER TABLE "cari_hareketleri" ADD COLUMN     "cekSenetId" INTEGER;

-- AlterTable
ALTER TABLE "tahsilatlar" ADD COLUMN     "kasaId" INTEGER;

-- CreateTable
CREATE TABLE "kasalar" (
    "id" SERIAL NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "tur" "KasaTur" NOT NULL DEFAULT 'NAKIT',
    "paraBirimi" TEXT NOT NULL DEFAULT 'TRY',
    "banka" TEXT,
    "bankaSube" TEXT,
    "hesapNo" TEXT,
    "ibanNo" TEXT,
    "posKomisyonOrani" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "acilisBakiye" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "bakiye" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notu" TEXT,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,
    "olusturanId" INTEGER,
    "guncelleyenId" INTEGER,
    "silindi" BOOLEAN NOT NULL DEFAULT false,
    "silmeTarihi" TIMESTAMP(3),

    CONSTRAINT "kasalar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kasa_hareketleri" (
    "id" SERIAL NOT NULL,
    "kasaId" INTEGER NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tur" "KasaHareketTur" NOT NULL,
    "tutar" DECIMAL(18,2) NOT NULL,
    "aciklama" TEXT,
    "belgeNo" TEXT,
    "masrafTuru" TEXT,
    "cariId" INTEGER,
    "karsiKasaId" INTEGER,
    "virmanGrubu" TEXT,
    "tahsilatId" INTEGER,
    "cekSenetId" INTEGER,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "olusturanId" INTEGER,
    "silindi" BOOLEAN NOT NULL DEFAULT false,
    "silmeTarihi" TIMESTAMP(3),

    CONSTRAINT "kasa_hareketleri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cek_senetler" (
    "id" SERIAL NOT NULL,
    "portfoyNo" TEXT NOT NULL,
    "tur" "CekSenetTur" NOT NULL DEFAULT 'CEK',
    "yon" "CekSenetYon" NOT NULL DEFAULT 'ALINAN',
    "cariId" INTEGER,
    "tutar" DECIMAL(18,2) NOT NULL,
    "paraBirimi" TEXT NOT NULL DEFAULT 'TRY',
    "vadeTarihi" TIMESTAMP(3) NOT NULL,
    "kesideTarihi" TIMESTAMP(3),
    "kesideYeri" TEXT,
    "borclu" TEXT,
    "banka" TEXT,
    "bankaSube" TEXT,
    "hesapNo" TEXT,
    "belgeNo" TEXT,
    "durum" "CekSenetDurum" NOT NULL DEFAULT 'PORTFOYDE',
    "onayDurumu" "OnayDurum" NOT NULL DEFAULT 'BEKLIYOR',
    "onaylayanId" INTEGER,
    "onayTarihi" TIMESTAMP(3),
    "onayNotu" TEXT,
    "tahsilKasaId" INTEGER,
    "tahsilTarihi" TIMESTAMP(3),
    "ciroCariId" INTEGER,
    "aciklama" TEXT,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,
    "olusturanId" INTEGER,
    "guncelleyenId" INTEGER,
    "silindi" BOOLEAN NOT NULL DEFAULT false,
    "silmeTarihi" TIMESTAMP(3),

    CONSTRAINT "cek_senetler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cek_senet_hareketleri" (
    "id" SERIAL NOT NULL,
    "cekSenetId" INTEGER NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "oncekiDurum" "CekSenetDurum",
    "yeniDurum" "CekSenetDurum" NOT NULL,
    "aciklama" TEXT,
    "kasaId" INTEGER,
    "cariId" INTEGER,
    "kullaniciId" INTEGER,
    "kullaniciKod" TEXT,

    CONSTRAINT "cek_senet_hareketleri_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kasalar_kod_key" ON "kasalar"("kod");

-- CreateIndex
CREATE INDEX "kasalar_aktif_silindi_idx" ON "kasalar"("aktif", "silindi");

-- CreateIndex
CREATE INDEX "kasa_hareketleri_kasaId_tarih_idx" ON "kasa_hareketleri"("kasaId", "tarih");

-- CreateIndex
CREATE INDEX "kasa_hareketleri_tarih_idx" ON "kasa_hareketleri"("tarih");

-- CreateIndex
CREATE INDEX "kasa_hareketleri_virmanGrubu_idx" ON "kasa_hareketleri"("virmanGrubu");

-- CreateIndex
CREATE UNIQUE INDEX "cek_senetler_portfoyNo_key" ON "cek_senetler"("portfoyNo");

-- CreateIndex
CREATE INDEX "cek_senetler_yon_durum_silindi_idx" ON "cek_senetler"("yon", "durum", "silindi");

-- CreateIndex
CREATE INDEX "cek_senetler_vadeTarihi_idx" ON "cek_senetler"("vadeTarihi");

-- CreateIndex
CREATE INDEX "cek_senetler_cariId_idx" ON "cek_senetler"("cariId");

-- CreateIndex
CREATE INDEX "cek_senetler_onayDurumu_idx" ON "cek_senetler"("onayDurumu");

-- CreateIndex
CREATE INDEX "cek_senet_hareketleri_cekSenetId_tarih_idx" ON "cek_senet_hareketleri"("cekSenetId", "tarih");

-- AddForeignKey
ALTER TABLE "tahsilatlar" ADD CONSTRAINT "tahsilatlar_kasaId_fkey" FOREIGN KEY ("kasaId") REFERENCES "kasalar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cari_hareketleri" ADD CONSTRAINT "cari_hareketleri_cekSenetId_fkey" FOREIGN KEY ("cekSenetId") REFERENCES "cek_senetler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kasa_hareketleri" ADD CONSTRAINT "kasa_hareketleri_kasaId_fkey" FOREIGN KEY ("kasaId") REFERENCES "kasalar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kasa_hareketleri" ADD CONSTRAINT "kasa_hareketleri_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "cariler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kasa_hareketleri" ADD CONSTRAINT "kasa_hareketleri_karsiKasaId_fkey" FOREIGN KEY ("karsiKasaId") REFERENCES "kasalar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kasa_hareketleri" ADD CONSTRAINT "kasa_hareketleri_tahsilatId_fkey" FOREIGN KEY ("tahsilatId") REFERENCES "tahsilatlar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kasa_hareketleri" ADD CONSTRAINT "kasa_hareketleri_cekSenetId_fkey" FOREIGN KEY ("cekSenetId") REFERENCES "cek_senetler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cek_senetler" ADD CONSTRAINT "cek_senetler_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "cariler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cek_senetler" ADD CONSTRAINT "cek_senetler_tahsilKasaId_fkey" FOREIGN KEY ("tahsilKasaId") REFERENCES "kasalar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cek_senetler" ADD CONSTRAINT "cek_senetler_ciroCariId_fkey" FOREIGN KEY ("ciroCariId") REFERENCES "cariler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cek_senet_hareketleri" ADD CONSTRAINT "cek_senet_hareketleri_cekSenetId_fkey" FOREIGN KEY ("cekSenetId") REFERENCES "cek_senetler"("id") ON DELETE CASCADE ON UPDATE CASCADE;
