BEGIN TRANSACTION;
CREATE TABLE "tv" (
	"id"            TEXT NOT NULL UNIQUE,
	"series_title"  TEXT NOT NULL,
	"episode_title" TEXT NOT NULL,
	"created_at"    TEXT NOT NULL,
	"device_id"     TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("device_id") REFERENCES "devices"("id")
);
COMMIT;
