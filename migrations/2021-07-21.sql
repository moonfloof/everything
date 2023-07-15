BEGIN TRANSACTION;
CREATE TABLE "purchases" (
	"id"         TEXT NOT NULL UNIQUE,
	"amount"     NUMERIC NOT NULL,
	"merchant"   TEXT NOT NULL,
	"category"   TEXT,
	"currency"   TEXT NOT NULL DEFAULT 'GBP',
	"created_at" TEXT NOT NULL,
	"device_id"  TEXT,
	PRIMARY KEY("id"),
	FOREIGN KEY("device_id") REFERENCES "devices"("id")
);
COMMIT;
