BEGIN TRANSACTION;
CREATE TABLE "food" (
	"id"         TEXT NOT NULL UNIQUE,
	"name"       TEXT NOT NULL,
	"type"       TEXT NOT NULL DEFAULT 'food',
	"created_at" TEXT NOT NULL,
	"device_id"  TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("device_id") REFERENCES "devices"("id")
);
COMMIT;
