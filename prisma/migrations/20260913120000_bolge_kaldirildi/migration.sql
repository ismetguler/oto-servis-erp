-- Bölge kavramı (Cari kartındaki MERKEZ/DOĞU/BATI gibi sınıflandırma) sistemden
-- tamamen kaldırıldı. `Tanim` tablosundaki BOLGE türü enum değeri ve varsa eski
-- veriler (tıpkı ARAC_NEREDE/STOK_GRUP gibi) dokunulmadan bırakıldı — enum
-- değeri silmek Postgres'te tipin yeniden yaratılmasını gerektirir ve bu
-- projede küçük DB'lerde riskli bulunuyor (bkz. motor alanı migration'ları).
-- Sadece Cari tarafındaki gerçek kullanım (bolgeId ilişkisi) sökülüyor.

ALTER TABLE "cariler" DROP CONSTRAINT "cariler_bolgeId_fkey";

DROP INDEX "cariler_bolgeId_idx";

ALTER TABLE "cariler" DROP COLUMN "bolgeId";
