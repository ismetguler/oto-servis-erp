-- AlterTable
ALTER TABLE "kabuller" ADD COLUMN     "evrakKdvOrani" DECIMAL(6,2) NOT NULL DEFAULT 20,
ADD COLUMN     "tahminiKm" INTEGER,
ADD COLUMN     "teslimNotu" TEXT;

-- CreateTable
CREATE TABLE "kabul_personelleri" (
    "id" SERIAL NOT NULL,
    "kabulId" INTEGER NOT NULL,
    "personelId" INTEGER NOT NULL,

    CONSTRAINT "kabul_personelleri_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kabul_personelleri_personelId_idx" ON "kabul_personelleri"("personelId");

-- CreateIndex
CREATE UNIQUE INDEX "kabul_personelleri_kabulId_personelId_key" ON "kabul_personelleri"("kabulId", "personelId");

-- AddForeignKey
ALTER TABLE "kabul_personelleri" ADD CONSTRAINT "kabul_personelleri_kabulId_fkey" FOREIGN KEY ("kabulId") REFERENCES "kabuller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kabul_personelleri" ADD CONSTRAINT "kabul_personelleri_personelId_fkey" FOREIGN KEY ("personelId") REFERENCES "cariler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kabul_kalemleri" ADD CONSTRAINT "kabul_kalemleri_personelId_fkey" FOREIGN KEY ("personelId") REFERENCES "cariler"("id") ON DELETE SET NULL ON UPDATE CASCADE;
