import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';

function insertNewRecord (category, timestamp, deviceId) {
	const statement = getStatement(
		'insertTimeTracking',
		`INSERT INTO timetracking
		(id, category, created_at, duration_secs, device_id)
		VALUES
		($id, $category, $createdAt, 0, $deviceId)`,
	);

	return statement.run({
		id: uuid(),
		category,
		createdAt: new Date(timestamp).toISOString(),
		deviceId,
	});
}

function endSession (id, createdAt, timestamp) {
	const updateStatement = getStatement(
		'updateTimeTracking',
		`UPDATE timetracking
		SET
			ended_at = $endedAt,
			duration_secs = $duration
		WHERE id = $id`,
	);

	const startedAt = new Date(createdAt);
	const endedAt = new Date(timestamp);
	const duration = (endedAt.getTime() - startedAt.getTime()) / 1000;

	updateStatement.run({
		id,
		duration,
		endedAt: endedAt.toISOString(),
	});
}

/**
 * @export
 * @param {string} category
 * @param {string} timestamp
 * @param {string} deviceId
 * @return {void}
 */
export function insertTimeTracking (category, timestamp, deviceId) {
	const selectStatement = getStatement(
		'selectTimeTracking',
		`SELECT * FROM timetracking
		WHERE ended_at IS NULL
		ORDER BY created_at DESC
		LIMIT 1`,
	);

	const row = selectStatement.get();

	if (row !== undefined) {
		endSession(row.id, row.created_at, timestamp);
	}

	if (category.toLowerCase().startsWith('stop')) return;

	insertNewRecord(category, timestamp, deviceId);
}
