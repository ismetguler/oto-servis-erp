-- CreateEnum
CREATE TYPE "StokTransferDurum" AS ENUM ('TASLAK', 'ONAYLANDI', 'IPTAL', 'GERI_ALINDI');

-- AlterEnum
ALTER TYPE "NumaratorTur" ADD VALUE 'TRANSFER';

-- CreateTable
CREATE TABLE "stok_transfer_fisleri" (
    "id" SERIAL NOT NULL,
    "fisNo" TEXT NOT NULL,
    "kaynakDepoId" INTEGER NOT NULL,
    "hedefDepoId" INTEGER NOT NULL,
    "durum" "StokTransferDurum" NOT NULL DEFAULT 'TASLAK',
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aciklama" TEXT,
    "olusturanId" INTEGER,
    "onaylayanId" INTEGER,
    "onayTarihi" TIMESTAMP(3),
    "geriAlanId" INTEGER,
    "geriAlmaTarihi" TIMESTAMP(3),
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stok_transfer_fisleri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stok_transfer_kalemleri" (
    "id" SERIAL NOT NULL,
    "stokTransferFisiId" INTEGER NOT NULL,
    "stokId" INTEGER NOT NULL,
    "miktar" DECIMAL(18,3) NOT NULL DEFAULT 0,

    CONSTRAINT "stok_transfer_kalemleri_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stok_transfer_fisleri_fisNo_key" ON "stok_transfer_fisleri"("fisNo");

-- CreateIndex
CREATE INDEX "stok_transfer_fisleri_durum_idx" ON "stok_transfer_fisleri"("durum");

-- CreateIndex
CREATE UNIQUE INDEX "stok_transfer_kalemleri_stokTransferFisiId_stokId_key" ON "stok_transfer_kalemleri"("stokTransferFisiId", "stokId");

-- AddForeignKey
ALTER TABLE "stok_transfer_fisleri" ADD CONSTRAINT "stok_transfer_fisleri_kaynakDepoId_fkey" FOREIGN KEY ("kaynakDepoId") REFERENCES "depolar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stok_transfer_fisleri" ADD CONSTRAINT "stok_transfer_fisleri_hedefDepoId_fkey" FOREIGN KEY ("hedefDepoId") REFERENCES "depolar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stok_transfer_kalemleri" ADD CONSTRAINT "stok_transfer_kalemleri_stokTransferFisiId_fkey" FOREIGN KEY ("stokTransferFisiId") REFERENCES "stok_transfer_fisleri"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stok_transfer_kalemleri" ADD CONSTRAINT "stok_transfer_kalemleri_stokId_fkey" FOREIGN KEY ("stokId") REFERENCES "stoklar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
