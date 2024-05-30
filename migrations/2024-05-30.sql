-- Convert YouTube liked video URLs into video IDs

BEGIN TRANSACTION;

ALTER TABLE youtubelikes ADD COLUMN video_id TEXT;

-- This assumes every URL starts with "https://www.youtube.com/watch?v="
UPDATE youtubelikes SET video_id = SUBSTRING(url, 33, 100);

ALTER TABLE youtubelikes DROP COLUMN url;

COMMIT;
