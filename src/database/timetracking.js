import { v4 as uuid } from 'uuid';
import { calculateOffset, RECORDS_PER_PAGE } from './constants.js';
import { getStatement } from './database.js';

function insertNewRecord (category, created_at, device_id) {
	const statement = getStatement(
		'insertTimeTracking',
		`INSERT INTO timetracking
		(id, category, created_at, duration_secs, device_id)
		VALUES
		($id, $category, $created_at, 0, $device_id)`,
	);

	return statement.run({
		id: uuid(),
		category,
		created_at: new Date(created_at).toISOString(),
		device_id,
	});
}

function endTimeTrackingSession (id, created_at, timestamp) {
	const updateStatement = getStatement(
		'endTimeTrackingSession',
		`UPDATE timetracking
		SET
			ended_at = $ended_at,
			duration_secs = $duration_secs
		WHERE id = $id`,
	);

	const started_at = new Date(created_at);
	const ended_at = new Date(timestamp);
	const duration_secs = (ended_at.getTime() - started_at.getTime()) / 1000;

	updateStatement.run({
		id,
		duration_secs,
		ended_at: ended_at.toISOString(),
	});
}

/**
 * @export
 * @param {string} category
 * @param {string} timestamp
 * @param {string} device_id
 * @return {void}
 */
export function insertTimeTracking (category, created_at, device_id) {
	const selectStatement = getStatement(
		'selectTimeTracking',
		`SELECT * FROM timetracking
		WHERE ended_at IS NULL
		ORDER BY created_at DESC
		LIMIT 1`,
	);

	const row = selectStatement.get();

	if (row !== undefined) {
		endTimeTrackingSession(row.id, row.created_at, created_at);
	}

	if (category.toLowerCase().startsWith('stop')) return;

	insertNewRecord(category, created_at, device_id);
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
	if (category?.toLowerCase().startsWith('stop')) {
		return;
	}

	const statement = getStatement(
		'updateTimeTracking',
		`UPDATE timetracking
		SET category = $category,
		    created_at = $created_at,
		    ended_at = $ended_at,
		    duration_secs = $duration_secs
		WHERE id = $id`,
	);

	const ended_at_date = new Date(ended_at || Date.now());

	const created_at_ms = new Date(created_at).getTime();
	const ended_at_ms = ended_at_date.getTime();
	const duration_secs = (ended_at_ms - created_at_ms) / 1000;

	return statement.run({
		id,
		category,
		created_at,
		ended_at: ended_at_date.toISOString(),
		duration_secs,
	});
}
