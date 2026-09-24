-- CreateEnum
CREATE TYPE "SayimDurum" AS ENUM ('TASLAK', 'ONAYLANDI', 'IPTAL');

-- AlterEnum
ALTER TYPE "NumaratorTur" ADD VALUE 'SAYIM';

-- AlterTable
ALTER TABLE "stok_hareketleri" ADD COLUMN     "sayimFisiId" INTEGER;

-- CreateTable
CREATE TABLE "sayim_fisleri" (
    "id" SERIAL NOT NULL,
    "fisNo" TEXT NOT NULL,
    "depoId" INTEGER,
    "urunGrubu" TEXT,
    "durum" "SayimDurum" NOT NULL DEFAULT 'TASLAK',
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aciklama" TEXT,
    "olusturanId" INTEGER,
    "onaylayanId" INTEGER,
    "onayTarihi" TIMESTAMP(3),
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sayim_fisleri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sayim_kalemleri" (
    "id" SERIAL NOT NULL,
    "sayimFisiId" INTEGER NOT NULL,
    "stokId" INTEGER NOT NULL,
    "sistemMiktar" DECIMAL(18,3) NOT NULL,
    "sayilanMiktar" DECIMAL(18,3) NOT NULL,
    "fark" DECIMAL(18,3) NOT NULL,
    "aciklama" TEXT,

    CONSTRAINT "sayim_kalemleri_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sayim_fisleri_fisNo_key" ON "sayim_fisleri"("fisNo");

-- CreateIndex
CREATE INDEX "sayim_fisleri_durum_idx" ON "sayim_fisleri"("durum");

-- CreateIndex
CREATE UNIQUE INDEX "sayim_kalemleri_sayimFisiId_stokId_key" ON "sayim_kalemleri"("sayimFisiId", "stokId");

-- AddForeignKey
ALTER TABLE "sayim_fisleri" ADD CONSTRAINT "sayim_fisleri_depoId_fkey" FOREIGN KEY ("depoId") REFERENCES "depolar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sayim_kalemleri" ADD CONSTRAINT "sayim_kalemleri_sayimFisiId_fkey" FOREIGN KEY ("sayimFisiId") REFERENCES "sayim_fisleri"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sayim_kalemleri" ADD CONSTRAINT "sayim_kalemleri_stokId_fkey" FOREIGN KEY ("stokId") REFERENCES "stoklar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
