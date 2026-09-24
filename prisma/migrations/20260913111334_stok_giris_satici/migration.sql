-- AlterTable
ALTER TABLE "stok_giris_fisleri" ADD COLUMN     "cariId" INTEGER;

-- CreateIndex
CREATE INDEX "stok_giris_fisleri_cariId_idx" ON "stok_giris_fisleri"("cariId");

-- AddForeignKey
ALTER TABLE "stok_giris_fisleri" ADD CONSTRAINT "stok_giris_fisleri_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "cariler"("id") ON DELETE SET NULL ON UPDATE CASCADE;
