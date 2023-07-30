BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS "gameachievements" (
	"id"           TEXT NOT NULL UNIQUE,
	"name"         TEXT NOT NULL,
	"description"  TEXT,

	-- Associate with a collective game
	"game_name"    TEXT NOT NULL,

	-- Associate with a specific game entry
	"game_id"      TEXT NOT NULL,

	"created_at"   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at"   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"device_id"    TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("device_id") REFERENCES "devices"("id"),
	FOREIGN KEY("game_id") REFERENCES "games"("id")
);

COMMIT;
