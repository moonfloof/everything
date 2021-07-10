BEGIN TRANSACTION;
CREATE TABLE "books" (
	"id"             TEXT NOT NULL UNIQUE,
	"title"          TEXT NOT NULL,
	"author"         TEXT NOT NULL,
	"genre"          TEXT,
	"year"           INTEGER NOT NULL,
	"pages_total"    INTEGER,
	"pages_progress" INTEGER,
	"rating"         INTEGER,
	"url"            TEXT,
	"started_at"     TEXT NOT NULL,
	"completed_at"   TEXT,
	"created_at"     TEXT NOT NULL,
	"updated_at"     TEXT NOT NULL,
	"device_id"      TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("device_id") REFERENCES "devices"("id")
);
COMMIT;
