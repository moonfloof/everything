import { v4 as uuid } from 'uuid';
import { calculateOffset, RECORDS_PER_PAGE } from './constants.js';
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

export function getTimeTracking (id, page) {
	const statement = getStatement(
		'getTimeTracking',
		`SELECT * FROM timetracking
		WHERE id LIKE $id
		ORDER BY created_at DESC
		LIMIT ${RECORDS_PER_PAGE} OFFSET $offset`,
	);

	return statement.all({
		id: id || '%',
		offset: calculateOffset(page),
	});
}

export function countTimeTracking () {
	const statement = getStatement(
		'countTimeTracking',
		'SELECT COUNT(*) as total FROM timetracking',
	);

	return statement.get().total;
}

export function deleteTimeTracking (id) {
	const statement = getStatement(
		'deleteTimeTracking',
		'DELETE FROM timetracking WHERE id = $id',
	);

	return statement.run({ id });
}

export function updateTimeTracking (id, category, created_at, ended_at) {
	const statement = getStatement(
		'updateTimeTracking',
		`UPDATE timetracking
		SET category = $category,
		    created_at = $created_at,
		    ended_at = $ended_at,
		    duration_secs = $duration_secs
		WHERE id = $id`,
	);

	const createdAtMs = new Date(created_at).getTime();
	const endedAtMs = new Date(ended_at).getTime();
	const duration_secs = (endedAtMs - createdAtMs) / 1000;

	return statement.run({
		id,
		category,
		created_at,
		ended_at,
		duration_secs,
	});
}
