-- AlterTable
ALTER TABLE "evraklar" ADD COLUMN     "irsaliyeNo" TEXT,
ADD COLUMN     "irsaliyeTarihi" TIMESTAMP(3),
ADD COLUMN     "kaynakEvrakNo" TEXT,
ADD COLUMN     "sevkAdresi" TEXT,
ADD COLUMN     "tasiyiciPlaka" TEXT,
ADD COLUMN     "tevkifatKodu" TEXT,
ADD COLUMN     "tevkifatOrani" DECIMAL(6,2);

-- AlterTable
ALTER TABLE "firma" ADD COLUMN     "bankaAdi" TEXT,
ADD COLUMN     "ibanNo" TEXT;
