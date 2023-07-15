BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "youtubelikes" (
	"id"         TEXT NOT NULL UNIQUE,
	"url"        TEXT NOT NULL,
	"title"      TEXT NOT NULL,
	"channel"    TEXT NOT NULL,
	"created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"device_id"  TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("device_id") REFERENCES "devices"("id")
);
COMMIT;
