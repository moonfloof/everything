BEGIN TRANSACTION;
CREATE TABLE "bookmarks" (
	"id"          TEXT NOT NULL UNIQUE,
	"title"       TEXT NOT NULL,
	"url"         TEXT NOT NULL,
	"created_at"  TEXT NOT NULL,
	"device_id"   TEXT NOT NULL,
	FOREIGN KEY("device_id") REFERENCES "devices"("id"),
	PRIMARY KEY("id")
);
COMMIT;
