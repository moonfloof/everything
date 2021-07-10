BEGIN TRANSACTION;
CREATE TABLE steps (
	"id"               TEXT NOT NULL UNIQUE,
	"step_count_total" INTEGER NOT NULL,
	"created_at"       TEXT NOT NULL UNIQUE,
	"device_id"        TEXT NOT NULL,
	FOREIGN KEY("device_id") REFERENCES "devices"("id"),
	PRIMARY KEY("id")
);
COMMIT;
