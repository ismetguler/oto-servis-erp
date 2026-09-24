-- AlterTable: satıcı artık serbest metin, cari aramaya zorlanmıyor.
ALTER TABLE "stok_giris_fisleri" ADD COLUMN "saticiAdi" TEXT;

-- Mevcut cari bağlantısı varsa unvanı yeni alana taşı (veri kaybı olmasın).
UPDATE "stok_giris_fisleri" f
SET "saticiAdi" = c."unvan"
FROM "cariler" c
WHERE f."cariId" = c."id";

-- DropForeignKey
ALTER TABLE "stok_giris_fisleri" DROP CONSTRAINT IF EXISTS "stok_giris_fisleri_cariId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "stok_giris_fisleri_cariId_idx";

-- AlterTable
ALTER TABLE "stok_giris_fisleri" DROP COLUMN "cariId";
