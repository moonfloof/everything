BEGIN TRANSACTION;

ALTER TABLE films
ADD COLUMN "duration_secs" INTEGER;

ALTER TABLE tv
ADD COLUMN "duration_secs" INTEGER;

ALTER TABLE youtubelikes
ADD COLUMN "duration_secs" INTEGER;

COMMIT;
