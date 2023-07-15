BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "games" (
	"id"            TEXT NOT NULL UNIQUE,
	"name"          TEXT NOT NULL,
	"playtime_mins" INTEGER NOT NULL,
	"created_at"    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at"    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"device_id"     TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("device_id") REFERENCES "devices"("id")
);
COMMIT;
