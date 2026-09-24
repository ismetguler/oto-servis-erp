-- AlterTable
ALTER TABLE "kabuller" ADD COLUMN     "garantiDosyaNo" TEXT,
ADD COLUMN     "garantiDurumu" TEXT,
ADD COLUMN     "garantiNotu" TEXT,
ADD COLUMN     "garantiOnayNo" TEXT,
ADD COLUMN     "garantiTalepTarihi" TIMESTAMP(3),
ADD COLUMN     "garantiTutar" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "garantiVerenId" INTEGER;

-- CreateIndex
CREATE INDEX "kabuller_garantiVerenId_idx" ON "kabuller"("garantiVerenId");

-- AddForeignKey
ALTER TABLE "kabuller" ADD CONSTRAINT "kabuller_garantiVerenId_fkey" FOREIGN KEY ("garantiVerenId") REFERENCES "cariler"("id") ON DELETE SET NULL ON UPDATE CASCADE;
