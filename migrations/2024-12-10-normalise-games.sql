BEGIN TRANSACTION;

-- Step 1: Create games_game table (better name pls??)
ALTER TABLE "games"
RENAME TO "games_old";

ALTER TABLE "gameachievements"
RENAME TO "gameachievements_old";

CREATE TABLE "games" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"name" TEXT NOT NULL UNIQUE,
	"url" TEXT
);

-- Step 2: Insert all unique game names into new table
INSERT INTO
	"games" (name, url)
SELECT
	name,
	url
FROM
	games_old
GROUP BY
	name;

-- Step 3: Add `game_id` column to `games` table
CREATE TABLE "game_session" (
	"id" TEXT NOT NULL UNIQUE,
	"game_id" INTEGER NOT NULL,
	"playtime_mins" INTEGER NOT NULL,
	"created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"device_id" TEXT NOT NULL,
	PRIMARY KEY ("id"),
	FOREIGN KEY ("game_id") REFERENCES "games" ("id") ON DELETE CASCADE,
	FOREIGN KEY ("device_id") REFERENCES "devices" ("id")
);

CREATE TABLE "game_achievements" (
	"id" TEXT NOT NULL UNIQUE,
	"game_id" INTEGER NOT NULL,
	"unlocked_session_id" TEXT,
	"name" TEXT NOT NULL,
	"description" TEXT,
	"apiname" TEXT, -- Doesn't exist currently, would prefer to be required.
	"created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY ("game_id") REFERENCES "games" ("id") ON DELETE CASCADE,
	FOREIGN KEY ("unlocked_session_id") REFERENCES "game_session" ("id") ON DELETE SET NULL
);

-- Step 4: Update all records with `game_id`
INSERT INTO
	"game_session" (
		id,
		game_id,
		playtime_mins,
		created_at,
		updated_at,
		device_id
	)
SELECT
	s.id,
	g.id as game_id,
	s.playtime_mins,
	s.created_at,
	s.updated_at,
	s.device_id
FROM
	games_old AS s
	JOIN games AS g ON g.name = s.name;

INSERT INTO
	"game_achievements" (
		id,
		game_id,
		unlocked_session_id,
		name,
		description,
		created_at,
		updated_at
	)
SELECT
	a.id AS id,
	g.id AS game_id,
	s.id AS unlocked_session_id,
	a.name,
	a.description,
	a.created_at,
	a.updated_at
FROM
	gameachievements_old AS a
	JOIN games AS g ON g.name = a.game_name
	JOIN game_session AS s ON s.id = a.game_id;

DROP TABLE "gameachievements_old";

DROP TABLE "games_old";

COMMIT;

VACUUM;
