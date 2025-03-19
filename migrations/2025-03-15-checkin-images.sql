BEGIN TRANSACTION;

ALTER TABLE checkin_image
RENAME TO checkin_image_old;

CREATE TABLE IF NOT EXISTS "checkin_image" (
	-- Replace numeric ID with UUID
	"id" TEXT NOT NULL UNIQUE DEFAULT (uuid ()),
	-- These fields are the same
	"checkin_id" TEXT NOT NULL,
	"data" BLOB NOT NULL,
	-- A small thumbnail version of the image, to be used in maps
	-- Could be 150x150? (probably 2-4kb)
	"thumbnail_data" BLOB,
	-- Additional metadata that help contextualise a check-in
	"lat" REAL,
	"long" REAL,
	"taken_at" TEXT,
	PRIMARY KEY ("id"),
	FOREIGN KEY ("checkin_id") REFERENCES "checkin" ("id") ON DELETE CASCADE
);

INSERT INTO
	checkin_image (id, checkin_id, data)
SELECT
	(uuid ()),
	checkin_id,
	data
FROM
	checkin_image_old;

DROP TABLE checkin_image_old;

COMMIT;

VACUUM;
