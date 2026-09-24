-- Araç motor alanları sadeleştirildi:
--  * "Motor No", "Motor Gücü (kW)", "Beygir Gücü" alanları kaldırıldı
--    (serviste kimse doldurmuyordu, ekranları kalabalık ediyordu).
--  * "Motor Hacmi" artık cc tamsayı yerine serbest metin ("1.6", "1.5 TDI").
--    Eski sayısal değer korunur: "1995" -> "1995" olarak taşınır.
--
-- Her adım koşullu: tablo/kolon yoksa sessizce atlanır. Böylece yarım
-- kurulmuş ya da daha önce kısmen uygulanmış bir veritabanında migration
-- sertçe patlamaz, elinden geleni yapar.

DO $$
BEGIN
  IF to_regclass('public."Arac"') IS NULL THEN
    RAISE NOTICE 'Arac tablosu yok; motor alani sadelestirmesi atlandi.';
    RETURN;
  END IF;

  -- motorHacmi kolonu (yoksa ekle)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Arac'
      AND column_name = 'motorHacmi'
  ) THEN
    ALTER TABLE "Arac" ADD COLUMN "motorHacmi" TEXT;
  END IF;

  -- eski hacimCc değerini metne taşı (kolon hâlâ varsa)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Arac'
      AND column_name = 'hacimCc'
  ) THEN
    UPDATE "Arac"
       SET "motorHacmi" = "hacimCc"::text
     WHERE "hacimCc" IS NOT NULL
       AND "motorHacmi" IS NULL;
  END IF;

  ALTER TABLE "Arac" DROP COLUMN IF EXISTS "hacimCc";
  ALTER TABLE "Arac" DROP COLUMN IF EXISTS "motorKw";
  ALTER TABLE "Arac" DROP COLUMN IF EXISTS "beygirGucu";
  ALTER TABLE "Arac" DROP COLUMN IF EXISTS "motorNo";
END $$;
