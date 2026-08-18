BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS "link_preview" (
	"url" TEXT NOT NULL UNIQUE,
	"title" TEXT,
	"description" TEXT,
	"thumbnail_data" BLOB,
	PRIMARY KEY ("url")
);

COMMIT;
