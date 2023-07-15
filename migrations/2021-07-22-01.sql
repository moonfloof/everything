BEGIN TRANSACTION;
CREATE TABLE "weight" (
	"id"         TEXT NOT NULL UNIQUE,
	"weight_kgs" NUMERIC NOT NULL,
	"created_at" TEXT NOT NULL,
	"device_id"  TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("device_id") REFERENCES "devices"("id")
);
COMMIT;
