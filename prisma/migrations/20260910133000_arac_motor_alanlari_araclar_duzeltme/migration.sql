-- DÜZELTME: bir önceki migration (20260910120000) tabloyu "Arac" adıyla
-- aradı; oysa Prisma modeli `@@map("araclar")` ile eşleniyor, gerçek tablo
-- adı "araclar". O migration hiçbir şey yapmadan atladı (uygulandı sayıldı,
-- checksum bozulmasın diye dosyasına dokunulmuyor). Asıl iş burada yapılıyor.
--
--  * "Motor No", "Motor Gücü (kW)", "Beygir Gücü" alanları kaldırılır.
--  * "Motor Hacmi" cc tamsayı yerine serbest metin olur ("1.6", "1.5 TDI");
--    varsa eski sayısal değer metne taşınır.
--
-- Her adım koşullu: kısmen uygulanmış bir veritabanında tekrar çalışması
-- güvenli.

DO $$
BEGIN
  IF to_regclass('public."araclar"') IS NULL THEN
    RAISE NOTICE 'araclar tablosu yok; motor alani sadelestirmesi atlandi.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'araclar'
      AND column_name = 'motorHacmi'
  ) THEN
    ALTER TABLE "araclar" ADD COLUMN "motorHacmi" TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'araclar'
      AND column_name = 'hacimCc'
  ) THEN
    UPDATE "araclar"
       SET "motorHacmi" = "hacimCc"::text
     WHERE "hacimCc" IS NOT NULL
       AND "motorHacmi" IS NULL;
  END IF;

  ALTER TABLE "araclar" DROP COLUMN IF EXISTS "hacimCc";
  ALTER TABLE "araclar" DROP COLUMN IF EXISTS "motorKw";
  ALTER TABLE "araclar" DROP COLUMN IF EXISTS "beygirGucu";
  ALTER TABLE "araclar" DROP COLUMN IF EXISTS "motorNo";
END $$;
