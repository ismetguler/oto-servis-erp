-- AlterTable
ALTER TABLE "cariler" ADD COLUMN     "dogumTarihi" TIMESTAMP(3),
ADD COLUMN     "gorevi" TEXT,
ADD COLUMN     "iseGirisTarihi" TIMESTAMP(3),
ADD COLUMN     "istenCikisTarihi" TIMESTAMP(3),
ADD COLUMN     "komisyonOrani" DECIMAL(6,2) NOT NULL DEFAULT 0,
ADD COLUMN     "maas" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "sgkNo" TEXT;
