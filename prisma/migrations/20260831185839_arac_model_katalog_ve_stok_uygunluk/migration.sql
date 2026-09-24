-- AlterTable
ALTER TABLE "stoklar" ADD COLUMN     "uygunMarka" TEXT,
ADD COLUMN     "uygunModel" TEXT,
ADD COLUMN     "uygunYilBas" INTEGER,
ADD COLUMN     "uygunYilBit" INTEGER;

-- CreateTable
CREATE TABLE "arac_model_katalog" (
    "id" SERIAL NOT NULL,
    "marka" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "kilitli" BOOLEAN NOT NULL DEFAULT false,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,
    "olusturanId" INTEGER,

    CONSTRAINT "arac_model_katalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "arac_model_katalog_marka_idx" ON "arac_model_katalog"("marka");

-- CreateIndex
CREATE UNIQUE INDEX "arac_model_katalog_marka_model_key" ON "arac_model_katalog"("marka", "model");
