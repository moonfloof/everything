BEGIN TRANSACTION;
CREATE TABLE "films" (
	"id"           TEXT NOT NULL UNIQUE,
	"title"        TEXT NOT NULL,
	"year"         INTEGER NOT NULL,
	"rating"       INTEGER,
	"url"          TEXT,
	"watched_at"   TEXT NOT NULL,
	"created_at"   TEXT NOT NULL,
	"device_id"    TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("device_id") REFERENCES "devices"("id")
);
COMMIT;
