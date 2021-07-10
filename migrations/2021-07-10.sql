BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "devices" (
	"id"	TEXT NOT NULL UNIQUE,
	"api_key"	TEXT NOT NULL UNIQUE,
	"created_at"	NUMERIC NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"description"	TEXT,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "entries" (
	"id"	TEXT NOT NULL UNIQUE,
	"title"	TEXT,
	"description"	TEXT,
	"type"	TEXT NOT NULL,
	"length"	REAL,
	"location"	TEXT,
	"status"	TEXT NOT NULL DEFAULT 'public',
	"url"	TEXT,
	"created_at"	NUMERIC NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at"	NUMERIC NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"device_id"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("device_id") REFERENCES "devices"("id")
);
CREATE TABLE IF NOT EXISTS "location" (
	"id"	TEXT UNIQUE,
	"lat"	REAL NOT NULL,
	"long"	REAL NOT NULL,
	"city"	TEXT,
	"created_at"	NUMERIC NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"device_id"	TEXT NOT NULL,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "listens" (
	"id"	TEXT NOT NULL UNIQUE,
	"artist"	TEXT NOT NULL,
	"album"	TEXT NOT NULL,
	"title"	TEXT NOT NULL,
	"tracknumber"	INTEGER,
	"release_year"	INTEGER,
	"genre"	TEXT,
	"created_at"	NUMERIC NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"device_id"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("device_id") REFERENCES "devices"("id")
);
COMMIT;
