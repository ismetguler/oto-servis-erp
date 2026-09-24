-- AlterTable
ALTER TABLE "evraklar" ADD COLUMN     "siparisId" INTEGER;

-- CreateIndex
CREATE INDEX "evraklar_siparisId_idx" ON "evraklar"("siparisId");

-- AddForeignKey
ALTER TABLE "evraklar" ADD CONSTRAINT "evraklar_siparisId_fkey" FOREIGN KEY ("siparisId") REFERENCES "siparisler"("id") ON DELETE SET NULL ON UPDATE CASCADE;
