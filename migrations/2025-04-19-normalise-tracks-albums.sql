-- ⚠⚠ WARNING ⚠⚠
--
-- This migration assumes you have always had a well organised music library,
-- where your artists, albums, and their release years are all consistent within
-- the database. Running this migration without absolutely making sure will
-- result in the loss of some data.
--
-- Maybe I just can't write very good SQL, but I've tried my best...!
BEGIN TRANSACTION;

-- Step 1: Create new artist and album tables
CREATE TABLE IF NOT EXISTS "listens_artist" (
	"id" TEXT NOT NULL UNIQUE DEFAULT (uuid ()),
	"artist" TEXT NOT NULL UNIQUE,
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "listens_album" (
	"id" TEXT NOT NULL UNIQUE DEFAULT (uuid ()),
	"artist_id" TEXT NOT NULL,
	"album" TEXT NOT NULL,
	"release_year" INTEGER,
	"genre" TEXT,
	PRIMARY KEY ("id"),
	FOREIGN KEY ("artist_id") REFERENCES "listens_artist" ("id") ON DELETE CASCADE,
	UNIQUE (album, artist_id) ON CONFLICT IGNORE
);

-- Step 2: Create new tracks table with TEXT id and foreign keys
ALTER TABLE "listens_track"
RENAME TO "listens_track_old";

CREATE TABLE "listens_track" (
	"id" TEXT NOT NULL UNIQUE DEFAULT (uuid ()),
	"album_id" TEXT NOT NULL,
	"id_old" INTEGER, -- We'll be deleting this later!
	"title" TEXT NOT NULL,
	"track_number" INTEGER,
	"duration_secs" INTEGER,
	PRIMARY KEY ("id"),
	FOREIGN KEY ("album_id") REFERENCES "listens_album" ("id") ON DELETE CASCADE,
	UNIQUE (title, album_id) ON CONFLICT IGNORE
);

-- Step 3: Create new listens table with track foreign key as TEXT, with no need
--         for device_id column. It's time to start deprecating that feature.
ALTER TABLE "listens"
RENAME TO "listens_old";

CREATE TABLE "listens" (
	"id" TEXT NOT NULL UNIQUE DEFAULT (uuid ()),
	"track_id" TEXT NOT NULL,
	"created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY ("id"),
	FOREIGN KEY ("track_id") REFERENCES "listens_track" ("id") ON DELETE CASCADE
);

-- Step 4: Insert artists into new table
INSERT INTO
	"listens_artist" (artist)
SELECT DISTINCT
	artist COLLATE NOCASE
FROM
	listens_track_old;

-- Step 5: Insert albums into new table
INSERT INTO
	"listens_album" ("album", "release_year", "genre", "artist_id")
SELECT
	t.album,
	MIN(t.release_year),
	MIN(t.genre),
	r.id
FROM
	listens_track_old AS t
	JOIN listens_artist AS r ON r.artist = t.artist COLLATE NOCASE
GROUP BY
	lower(t.album),
	r.id;

-- Step 6: Insert tracks into new table
INSERT INTO
	"listens_track" (
		"id_old",
		"title",
		"track_number",
		"duration_secs",
		"album_id"
	)
SELECT
	t.id,
	t.title,
	t.track_number,
	t.duration_secs,
	(
		SELECT
			a.id
		FROM
			listens_album AS a
		WHERE
			a.album = t.album COLLATE NOCASE
			AND (
				a.release_year = t.release_year
				OR t.release_year IS NULL
			)
	) AS a_id
FROM
	listens_track_old AS t
WHERE
	a_id IS NOT NULL
GROUP BY
	lower(t.title),
	a_id
ORDER BY
	a_id,
	track_number ASC;

-- Step 7: Insert listens into new table
INSERT INTO
	"listens" ("track_id", "created_at")
SELECT
	(
		SELECT
			t.id
		FROM
			listens_track AS t
			JOIN listens_album AS a ON t.album_id = a.id
			JOIN listens_artist AS r ON a.artist_id = r.id
		WHERE
			t.title = tro.title COLLATE NOCASE
			AND (
				r.artist = tro.artist COLLATE NOCASE
				OR a.album = tro.album COLLATE NOCASE
				OR a.release_year = tro.release_year
			)
	) as t_id,
	l.created_at
FROM
	listens_old AS l
	JOIN listens_track_old AS tro ON tro.id = l.track_id
ORDER BY
	t_id ASC;

ALTER TABLE "listens_track"
DROP COLUMN "id_old";

DROP TABLE "listens_old";

DROP TABLE "listens_track_old";

COMMIT;

VACUUM;
