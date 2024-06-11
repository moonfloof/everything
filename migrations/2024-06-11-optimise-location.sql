-- Optimise location records:
-- 1. Removes unnecessary ID column (new table, because it's a primary key)
-- 2. Converts timestamps into numbers
-- 3. Finally, squash all the mess we just created by using VACUUM

BEGIN TRANSACTION;

ALTER TABLE location RENAME TO location_old;

CREATE TABLE location (
	"lat" NUMERIC NOT NULL,
	"long" NUMERIC NOT NULL,
	"city" TEXT,
	"created_at" NUMERIC NOT NULL,
	"device_id" TEXT NOT NULL,
	FOREIGN KEY("device_id") REFERENCES "devices"("id")
);

INSERT INTO location (lat, long, city, created_at, device_id)
SELECT lat, long, city, CAST(strftime('%s', created_at) AS INT) * 1000, device_id FROM location_old;

DROP TABLE location_old;

COMMIT;

VACUUM;
