BEGIN TRANSACTION;

-- Remove unused duration column
ALTER TABLE timetracking DROP COLUMN "duration_secs";

-- Copy all sleep records into timetracking table with category "Sleep"
INSERT INTO timetracking (id, created_at, ended_at, device_id, category)
SELECT id, started_at as created_at, ended_at, device_id, 'Sleep' FROM sleep;

-- Remove sleep table
DROP TABLE sleep;

COMMIT;
