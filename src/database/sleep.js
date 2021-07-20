import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import timeago from '../adapters/timeago.js';

function insertNewRecord (timestamp, deviceId) {
	const statement = getStatement(
		'insertSleepCycle',
		`INSERT INTO sleep
		(id, started_at, device_id)
		VALUES
		($id, $startedAt, $deviceId)`,
	);

	return statement.run({
		id: uuid(),
		startedAt: new Date(timestamp).toISOString(),
		deviceId,
	});
}

export function insertSleepCycle (timestamp, type, deviceId) {
	if (type?.toLowerCase() === 'sleep') {
		insertNewRecord(timestamp, deviceId);
		return;
	}

	const selectStatement = getStatement(
		'selectSleepCycle',
		`SELECT * FROM sleep
		WHERE ended_at = NULL
		ORDER BY started_at DESC`,
	);

	const row = selectStatement.get();

	if (row === undefined) {
		throw new Error('Cannot end a sleep cycle which has not started');
	}

	const updateStatement = getStatement(
		'updateSleepCycle',
		`UPDATE sleeps
		SET ended_at = $endedAt
		WHERE id = $id`,
	);

	updateStatement.run({
		id: row.id,
		endedAt: new Date(timestamp).toISOString(),
	});
}

/**
 * Fetch all YouTube likes, or based on a specific ID
 *
 * @export
 * @param {string} [id]
 * @param {number} [page]
 */
export function getLikes (id, page) {
	const statement = getStatement(
		'getYouTubeLikes',
		`SELECT * FROM youtubelikes
		WHERE id LIKE $id
		ORDER BY created_at DESC
		LIMIT 50 OFFSET $offset`,
	);

	return statement
		.all({
			id: id || '%',
			offset: page ? (page - 1) * 50 : 0,
		})
		.map(row => ({
			...row,
			timeago: timeago.format(new Date(row.created_at)),
		}));
}
