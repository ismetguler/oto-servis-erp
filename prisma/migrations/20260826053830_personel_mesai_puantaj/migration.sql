-- CreateEnum
CREATE TYPE "MesaiTur" AS ENUM ('TAM_GUN', 'YARIM_GUN', 'IZINLI', 'RAPORLU', 'DEVAMSIZ', 'RESMI_TATIL');

-- CreateTable
CREATE TABLE "mesai_kayitlari" (
    "id" SERIAL NOT NULL,
    "personelId" INTEGER NOT NULL,
    "tarih" DATE NOT NULL,
    "tur" "MesaiTur" NOT NULL DEFAULT 'TAM_GUN',
    "girisSaati" TIMESTAMP(3),
    "cikisSaati" TIMESTAMP(3),
    "calisilanSaat" DECIMAL(5,2),
    "notu" TEXT,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,
    "olusturanId" INTEGER,
    "guncelleyenId" INTEGER,
    "silindi" BOOLEAN NOT NULL DEFAULT false,
    "silmeTarihi" TIMESTAMP(3),

    CONSTRAINT "mesai_kayitlari_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mesai_kayitlari_tarih_idx" ON "mesai_kayitlari"("tarih");

-- CreateIndex
CREATE INDEX "mesai_kayitlari_personelId_idx" ON "mesai_kayitlari"("personelId");

-- CreateIndex
CREATE UNIQUE INDEX "mesai_kayitlari_personelId_tarih_key" ON "mesai_kayitlari"("personelId", "tarih");

-- AddForeignKey
ALTER TABLE "mesai_kayitlari" ADD CONSTRAINT "mesai_kayitlari_personelId_fkey" FOREIGN KEY ("personelId") REFERENCES "cariler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
