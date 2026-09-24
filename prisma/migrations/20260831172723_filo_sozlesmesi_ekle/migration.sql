-- CreateTable
CREATE TABLE "filo_sozlesmeleri" (
    "id" SERIAL NOT NULL,
    "cariId" INTEGER NOT NULL,
    "ad" TEXT NOT NULL,
    "baslangic" TIMESTAMP(3) NOT NULL,
    "bitis" TIMESTAMP(3) NOT NULL,
    "iskontoOrani" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "vadeGun" INTEGER NOT NULL DEFAULT 0,
    "kapsamPlakalari" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "notu" TEXT,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,
    "olusturanId" INTEGER,
    "guncelleyenId" INTEGER,
    "silindi" BOOLEAN NOT NULL DEFAULT false,
    "silmeTarihi" TIMESTAMP(3),

    CONSTRAINT "filo_sozlesmeleri_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "filo_sozlesmeleri_cariId_idx" ON "filo_sozlesmeleri"("cariId");

-- AddForeignKey
ALTER TABLE "filo_sozlesmeleri" ADD CONSTRAINT "filo_sozlesmeleri_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "cariler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
