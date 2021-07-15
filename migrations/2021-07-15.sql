BEGIN TRANSACTION;
CREATE TABLE "games" (
	"id"	TEXT NOT NULL UNIQUE,
	"name"	TEXT NOT NULL,
	"playtime_mins"	INTEGER NOT NULL,
	"currently_playing"	INTEGER NOT NULL DEFAULT 0,
	"device_id"	TEXT NOT NULL,
	FOREIGN KEY("device_id") REFERENCES "devices"("id")
);
COMMIT;
