-- CreateEnum
CREATE TYPE "StokGirisDurum" AS ENUM ('TASLAK', 'ONAYLANDI', 'GERI_ALINDI');

-- AlterTable
ALTER TABLE "stok_hareketleri" ADD COLUMN     "stokGirisFisiId" INTEGER;

-- CreateTable
CREATE TABLE "stok_giris_fisleri" (
    "id" SERIAL NOT NULL,
    "fisNo" TEXT NOT NULL,
    "depoId" INTEGER,
    "durum" "StokGirisDurum" NOT NULL DEFAULT 'TASLAK',
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aciklama" TEXT,
    "olusturanId" INTEGER,
    "onaylayanId" INTEGER,
    "onayTarihi" TIMESTAMP(3),
    "geriAlanId" INTEGER,
    "geriAlmaTarihi" TIMESTAMP(3),
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stok_giris_fisleri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stok_giris_kalemleri" (
    "id" SERIAL NOT NULL,
    "stokGirisFisiId" INTEGER NOT NULL,
    "stokId" INTEGER NOT NULL,
    "miktar" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "birimFiyat" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "tutar" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "stok_giris_kalemleri_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stok_giris_fisleri_fisNo_key" ON "stok_giris_fisleri"("fisNo");

-- CreateIndex
CREATE UNIQUE INDEX "stok_giris_kalemleri_stokGirisFisiId_stokId_key" ON "stok_giris_kalemleri"("stokGirisFisiId", "stokId");

-- AddForeignKey
ALTER TABLE "stok_giris_fisleri" ADD CONSTRAINT "stok_giris_fisleri_depoId_fkey" FOREIGN KEY ("depoId") REFERENCES "depolar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stok_giris_kalemleri" ADD CONSTRAINT "stok_giris_kalemleri_stokGirisFisiId_fkey" FOREIGN KEY ("stokGirisFisiId") REFERENCES "stok_giris_fisleri"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stok_giris_kalemleri" ADD CONSTRAINT "stok_giris_kalemleri_stokId_fkey" FOREIGN KEY ("stokId") REFERENCES "stoklar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
