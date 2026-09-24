-- CreateEnum
CREATE TYPE "SiparisTip" AS ENUM ('ALINAN', 'VERILEN');

-- CreateEnum
CREATE TYPE "SiparisDurum" AS ENUM ('TASLAK', 'ONAYLANDI', 'KISMI_SEVK', 'TAMAMLANDI', 'IPTAL');

-- CreateTable
CREATE TABLE "siparisler" (
    "id" SERIAL NOT NULL,
    "siparisNo" TEXT NOT NULL,
    "tip" "SiparisTip" NOT NULL DEFAULT 'ALINAN',
    "durum" "SiparisDurum" NOT NULL DEFAULT 'TASLAK',
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teslimTarihi" TIMESTAMP(3),
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

    CONSTRAINT "siparisler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siparis_kalemleri" (
    "id" SERIAL NOT NULL,
    "siparisId" INTEGER NOT NULL,
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
    "sevkMiktar" DECIMAL(18,3) NOT NULL DEFAULT 0,

    CONSTRAINT "siparis_kalemleri_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "siparisler_tarih_idx" ON "siparisler"("tarih");

-- CreateIndex
CREATE INDEX "siparisler_cariId_idx" ON "siparisler"("cariId");

-- CreateIndex
CREATE UNIQUE INDEX "siparisler_tip_siparisNo_key" ON "siparisler"("tip", "siparisNo");

-- CreateIndex
CREATE INDEX "siparis_kalemleri_siparisId_idx" ON "siparis_kalemleri"("siparisId");

-- AddForeignKey
ALTER TABLE "siparisler" ADD CONSTRAINT "siparisler_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "cariler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siparis_kalemleri" ADD CONSTRAINT "siparis_kalemleri_siparisId_fkey" FOREIGN KEY ("siparisId") REFERENCES "siparisler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siparis_kalemleri" ADD CONSTRAINT "siparis_kalemleri_stokId_fkey" FOREIGN KEY ("stokId") REFERENCES "stoklar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
