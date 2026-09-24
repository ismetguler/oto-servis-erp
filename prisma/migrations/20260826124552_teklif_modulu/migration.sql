-- CreateEnum
CREATE TYPE "TeklifDurum" AS ENUM ('TASLAK', 'ONAYLANDI', 'KABUL_EDILDI', 'REDDEDILDI', 'IPTAL');

-- AlterTable
ALTER TABLE "siparisler" ADD COLUMN     "teklifId" INTEGER;

-- CreateTable
CREATE TABLE "teklifler" (
    "id" SERIAL NOT NULL,
    "teklifNo" TEXT NOT NULL,
    "durum" "TeklifDurum" NOT NULL DEFAULT 'TASLAK',
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gecerlilikTarihi" TIMESTAMP(3),
    "cariId" INTEGER NOT NULL,
    "aciklama" TEXT,
    "paraBirimi" TEXT NOT NULL DEFAULT 'TRY',
    "araToplam" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "indirimToplam" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "kdvToplam" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "genelToplam" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,
    "olusturanId" INTEGER,
    "guncelleyenId" INTEGER,
    "silindi" BOOLEAN NOT NULL DEFAULT false,
    "silmeTarihi" TIMESTAMP(3),

    CONSTRAINT "teklifler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teklif_kalemleri" (
    "id" SERIAL NOT NULL,
    "teklifId" INTEGER NOT NULL,
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

    CONSTRAINT "teklif_kalemleri_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teklifler_tarih_idx" ON "teklifler"("tarih");

-- CreateIndex
CREATE INDEX "teklifler_cariId_idx" ON "teklifler"("cariId");

-- CreateIndex
CREATE UNIQUE INDEX "teklifler_teklifNo_key" ON "teklifler"("teklifNo");

-- CreateIndex
CREATE INDEX "teklif_kalemleri_teklifId_idx" ON "teklif_kalemleri"("teklifId");

-- CreateIndex
CREATE INDEX "siparisler_teklifId_idx" ON "siparisler"("teklifId");

-- AddForeignKey
ALTER TABLE "siparisler" ADD CONSTRAINT "siparisler_teklifId_fkey" FOREIGN KEY ("teklifId") REFERENCES "teklifler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teklifler" ADD CONSTRAINT "teklifler_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "cariler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teklif_kalemleri" ADD CONSTRAINT "teklif_kalemleri_teklifId_fkey" FOREIGN KEY ("teklifId") REFERENCES "teklifler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teklif_kalemleri" ADD CONSTRAINT "teklif_kalemleri_stokId_fkey" FOREIGN KEY ("stokId") REFERENCES "stoklar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
