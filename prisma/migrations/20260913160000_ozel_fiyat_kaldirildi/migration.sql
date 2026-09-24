-- "Özel Fiyat" kavramı (stok kartındaki 5 kademeli özel fiyat ve cari
-- kartındaki bu kademelerden hangisinin uygulanacağını seçen alan) sistemden
-- tamamen kaldırıldı. Bu alanlar hiçbir satış/fatura hesabında fiilen
-- okunmuyordu (yalnızca form + rapor amaçlıydı), bu yüzden kaldırılması
-- fiyatlama mantığını etkilemiyor.

ALTER TABLE "cariler" DROP COLUMN "fiyatKademesi";

ALTER TABLE "stoklar" DROP COLUMN "ozelFiyat1";
ALTER TABLE "stoklar" DROP COLUMN "ozelFiyat2";
ALTER TABLE "stoklar" DROP COLUMN "ozelFiyat3";
ALTER TABLE "stoklar" DROP COLUMN "ozelFiyat4";
ALTER TABLE "stoklar" DROP COLUMN "ozelFiyat5";
