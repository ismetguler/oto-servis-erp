-- CreateTable
CREATE TABLE "kara_liste_kayitlari" (
    "id" SERIAL NOT NULL,
    "cariId" INTEGER NOT NULL,
    "alisTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "neden" TEXT NOT NULL,
    "ekleyenId" INTEGER,
    "ekleyenKod" TEXT,
    "kaldirmaTarihi" TIMESTAMP(3),
    "kaldirmaNedeni" TEXT,
    "kaldiranId" INTEGER,
    "kaldiranKod" TEXT,

    CONSTRAINT "kara_liste_kayitlari_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kara_liste_kayitlari_cariId_alisTarihi_idx" ON "kara_liste_kayitlari"("cariId", "alisTarihi");

-- CreateIndex
CREATE INDEX "kara_liste_kayitlari_kaldirmaTarihi_idx" ON "kara_liste_kayitlari"("kaldirmaTarihi");

-- AddForeignKey
ALTER TABLE "kara_liste_kayitlari" ADD CONSTRAINT "kara_liste_kayitlari_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "cariler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kara_liste_kayitlari" ADD CONSTRAINT "kara_liste_kayitlari_ekleyenId_fkey" FOREIGN KEY ("ekleyenId") REFERENCES "kullanicilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kara_liste_kayitlari" ADD CONSTRAINT "kara_liste_kayitlari_kaldiranId_fkey" FOREIGN KEY ("kaldiranId") REFERENCES "kullanicilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Devir: tablo açılmadan önce kara listeye alınmış cariler için geçmiş satırı
-- üretiliyor. Olmasaydı bu kartlar "kara listede ama kaydı yok" görünürdü.
INSERT INTO "kara_liste_kayitlari" ("cariId", "alisTarihi", "neden", "ekleyenKod")
SELECT "id", COALESCE("guncellemeTarihi", "olusturmaTarihi"),
       COALESCE(NULLIF("karaListeNedeni", ''), 'Devir kaydı — neden belirtilmemiş'),
       'DEVIR'
FROM "cariler"
WHERE "karaListe" = true;
