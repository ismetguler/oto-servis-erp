-- AlterTable
ALTER TABLE "cek_senetler" ADD COLUMN     "tahsilatId" INTEGER;

-- AlterTable
ALTER TABLE "tahsilatlar" ADD COLUMN     "posBanka" TEXT,
ADD COLUMN     "posKartSahibi" TEXT,
ADD COLUMN     "posProvizyon" TEXT,
ADD COLUMN     "posSon4" TEXT,
ADD COLUMN     "posTaksit" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "cek_senetler_tahsilatId_key" ON "cek_senetler"("tahsilatId");

-- AddForeignKey
ALTER TABLE "cek_senetler" ADD CONSTRAINT "cek_senetler_tahsilatId_fkey" FOREIGN KEY ("tahsilatId") REFERENCES "tahsilatlar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
