-- İndirim / iskonto kavramı sistemden tamamen kaldırıldı (HAFIZA §113).
-- Dükkân indirim vermiyor; fiyat kalem üzerinde ayarlanıyor.

ALTER TABLE "cariler" DROP COLUMN "stokIndirimi",
                      DROP COLUMN "hizmetIndirimi";

ALTER TABLE "filo_sozlesmeleri" DROP COLUMN "iskontoOrani";

ALTER TABLE "kabuller" DROP COLUMN "indirimToplam";
ALTER TABLE "kabul_kalemleri" DROP COLUMN "indirimOran";

ALTER TABLE "evraklar" DROP COLUMN "indirimToplam";
ALTER TABLE "evrak_kalemleri" DROP COLUMN "indirimOran";

ALTER TABLE "teklifler" DROP COLUMN "indirimToplam";
ALTER TABLE "teklif_kalemleri" DROP COLUMN "indirimOran";

ALTER TABLE "siparisler" DROP COLUMN "indirimToplam";
ALTER TABLE "siparis_kalemleri" DROP COLUMN "indirimOran";
