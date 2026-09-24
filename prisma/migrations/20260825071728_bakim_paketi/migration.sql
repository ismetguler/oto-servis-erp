-- AlterEnum
ALTER TYPE "NumaratorTur" ADD VALUE 'PAKET_KOD';

-- CreateTable
CREATE TABLE "bakim_paketleri" (
    "id" SERIAL NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "aciklama" TEXT,
    "aracTuru" TEXT,
    "marka" TEXT,
    "km" INTEGER,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "silindi" BOOLEAN NOT NULL DEFAULT false,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bakim_paketleri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bakim_paketi_kalemleri" (
    "id" SERIAL NOT NULL,
    "paketId" INTEGER NOT NULL,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "tur" "KalemTur" NOT NULL,
    "stokId" INTEGER,
    "iscilikId" INTEGER,
    "aciklama" TEXT NOT NULL,
    "miktar" DECIMAL(18,3) NOT NULL DEFAULT 1,
    "birim" TEXT NOT NULL DEFAULT 'ADET',
    "fiyatSabit" DECIMAL(18,4),
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bakim_paketi_kalemleri_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bakim_paketleri_kod_key" ON "bakim_paketleri"("kod");

-- CreateIndex
CREATE INDEX "bakim_paketleri_ad_idx" ON "bakim_paketleri"("ad");

-- CreateIndex
CREATE INDEX "bakim_paketleri_silindi_aktif_idx" ON "bakim_paketleri"("silindi", "aktif");

-- CreateIndex
CREATE INDEX "bakim_paketi_kalemleri_paketId_idx" ON "bakim_paketi_kalemleri"("paketId");

-- AddForeignKey
ALTER TABLE "bakim_paketi_kalemleri" ADD CONSTRAINT "bakim_paketi_kalemleri_paketId_fkey" FOREIGN KEY ("paketId") REFERENCES "bakim_paketleri"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakim_paketi_kalemleri" ADD CONSTRAINT "bakim_paketi_kalemleri_stokId_fkey" FOREIGN KEY ("stokId") REFERENCES "stoklar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakim_paketi_kalemleri" ADD CONSTRAINT "bakim_paketi_kalemleri_iscilikId_fkey" FOREIGN KEY ("iscilikId") REFERENCES "iscilikler"("id") ON DELETE SET NULL ON UPDATE CASCADE;
