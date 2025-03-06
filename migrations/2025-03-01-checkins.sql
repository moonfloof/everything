BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS "checkin_place" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"name" TEXT NOT NULL,
	"address" TEXT,
	"category" TEXT NOT NULL DEFAULT "Other",
	"lat" REAL,
	"long" REAL,
	-- Used for storing Google Maps IDs or Swarm IDs, for caching purposes.
	-- Might be NULL if it's a user-created place.
	"external_id" TEXT,
	"created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "checkin" (
	"id" TEXT NOT NULL UNIQUE,
	"place_id" INTEGER NOT NULL,
	"description" TEXT NOT NULL,
	"status" TEXT NOT NULL DEFAULT "public",
	"created_at" TEXT NOT NULL,
	"updated_at" TEXT NOT NULL,
	"device_id" TEXT NOT NULL,
	PRIMARY KEY ("id"),
	FOREIGN KEY ("place_id") REFERENCES "checkin_place" ("id") ON DELETE CASCADE,
	FOREIGN KEY ("device_id") REFERENCES "devices" ("id")
);

CREATE TABLE IF NOT EXISTS "checkin_image" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"checkin_id" TEXT NOT NULL,
	-- Images stored as 1280x720 (or smaller) AVIF images, to be compact
	"data" BLOB NOT NULL,
	FOREIGN KEY ("checkin_id") REFERENCES "checkin" ("id") ON DELETE CASCADE
);

COMMIT;
