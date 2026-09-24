-- "Mesai Girişi" ve "Personel Komisyonları" özellikleri sistemden tamamen
-- kaldırıldı. "Personel Avansları" ekranı zaten ayrı tablo kullanmıyordu
-- (Tahsilat/CariHareket üzerinden okunuyordu), bu yüzden onun için şema
-- değişikliği yok.
--
-- `MesaiTur` enum değeri BOLGE/ARAC_NEREDE emsalinde olduğu gibi DB'de
-- bırakıldı — Postgres'te enum silmek tipin yeniden yaratılmasını
-- gerektiriyor ve bu projede küçük DB'lerde riskli bulunuyor.

ALTER TABLE "mesai_kayitlari" DROP CONSTRAINT "mesai_kayitlari_personelId_fkey";

DROP TABLE "mesai_kayitlari";

ALTER TABLE "cariler" DROP COLUMN "komisyonOrani";
