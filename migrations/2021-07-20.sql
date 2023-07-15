BEGIN TRANSACTION;
CREATE TABLE "sleep" (
	"id"         TEXT NOT NULL UNIQUE,
	"started_at" TEXT NOT NULL,
	"ended_at"   TEXT,
	"device_id"  TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("device_id") REFERENCES "devices"("id")
);
COMMIT;
