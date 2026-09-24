-- PanelDurum enum'undan HASARLI kaldırıldı.
--
-- İsmet'in kararı: şemada üç durum yeter (sahibinden'deki ile birebir).
-- Hasarı zaten parça listesi ve işçilik kırılımı anlatıyor.
--
-- PostgreSQL bir enum'dan DEĞER SİLEMEZ; tipin yeniden kurulması gerekiyor.
-- Tablo henüz boş (modül canlıya çıkmadı), bu yüzden dönüşüm veri kaybetmez.
ALTER TYPE "PanelDurum" RENAME TO "PanelDurum_eski";

CREATE TYPE "PanelDurum" AS ENUM ('LOKAL_BOYALI', 'BOYALI', 'DEGISMIS');

ALTER TABLE "ekspertiz_panelleri"
  ALTER COLUMN "durum" TYPE "PanelDurum"
  USING ("durum"::text::"PanelDurum");

DROP TYPE "PanelDurum_eski";
