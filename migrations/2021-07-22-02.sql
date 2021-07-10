BEGIN TRANSACTION;
CREATE TABLE "timetracking" (
	"id"            TEXT NOT NULL UNIQUE,
	"category"      TEXT NOT NULL,
	"created_at"    TEXT NOT NULL,
	"ended_at"      TEXT,
	"duration_secs" INTEGER NOT NULL DEFAULT 0,
	"device_id"     TEXT NOT NULL,
	FOREIGN KEY("device_id") REFERENCES "devices"("id"),
	PRIMARY KEY("id")
);
COMMIT;
