BEGIN TRANSACTION;

-- Step 1: Add listens_track table (includes unnormalised artist & album names)
CREATE TABLE IF NOT EXISTS "listens_track" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"artist" TEXT NOT NULL,
	"album" TEXT NOT NULL,
	"title" TEXT NOT NULL,
	"track_number" INTEGER,
	"release_year" INTEGER,
	"genre" TEXT,
	"duration_secs" INTEGER
);

-- Step 2: Get all unique tracks, insert them into track table
INSERT INTO
	listens_track (
		artist,
		album,
		title,
		track_number,
		release_year,
		genre
	)
SELECT
	artist,
	album,
	title,
	tracknumber,
	release_year,
	genre
FROM
	listens
GROUP BY
	artist,
	album,
	title
ORDER BY
	artist ASC,
	release_year ASC,
	tracknumber ASC;

-- Step 3: Add "track_id" column to listens table
ALTER TABLE "listens"
RENAME TO "listens_old";

CREATE TABLE "listens" (
	"id" TEXT NOT NULL UNIQUE,
	"track_id" INTEGER NOT NULL,
	"created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"device_id" TEXT NOT NULL,
	PRIMARY KEY ("id"),
	FOREIGN KEY ("device_id") REFERENCES "devices" ("id"),
	FOREIGN KEY ("track_id") REFERENCES "listens_track" ("id")
);

-- Step 4: Update all records with track id
INSERT INTO
	listens (id, track_id, created_at, device_id)
SELECT
	l.id,
	t.id as track_id,
	l.created_at,
	l.device_id
FROM
	listens_old AS l
	JOIN listens_track AS t ON l.artist = t.artist
	AND l.album = t.album
	AND l.title = t.title;

-- Step 5: Drop old listens table
DROP TABLE "listens_old";

COMMIT;

VACUUM;
