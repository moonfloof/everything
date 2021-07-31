import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import TimeAgo from '../adapters/timeago.js';
import { prettyDate, prettyDuration, shortDate } from '../lib/formatDate.js';
import { calculateOffset, RECORDS_PER_PAGE } from './constants.js';

function insertNewRecord (timestamp, device_id) {
	const statement = getStatement(
		'insertSleepCycle',
		`INSERT INTO sleep
		(id, started_at, device_id)
		VALUES
		($id, $started_at, $device_id)`,
	);

	return statement.run({
		id: uuid(),
		started_at: new Date(timestamp).toISOString(),
		device_id,
	});
}

export function insertSleepCycle (timestamp, isSleep, device_id) {
	if (isSleep) {
		insertNewRecord(timestamp, device_id);
		return;
	}

	const selectStatement = getStatement(
		'selectSleepCycle',
		`SELECT * FROM sleep
		WHERE ended_at IS NULL
		ORDER BY started_at DESC`,
	);

	const row = selectStatement.get();

	if (row === undefined) {
		throw new Error('Cannot end a sleep cycle which has not started');
	}

	const updateStatement = getStatement(
		'updateSleepCycle',
		`UPDATE sleep
		SET ended_at = $ended_at
		WHERE id = $id`,
	);

	updateStatement.run({
		id: row.id,
		ended_at: new Date(timestamp).toISOString(),
	});
}

/**
 * Fetch all sleep cycles, or one, based on a specific ID
 *
 * @export
 * @param {string} [id]
 * @param {number} [page]
 */
export function getSleepCycles (id, page) {
	const statement = getStatement(
		'getSleepCycles',
		`SELECT * FROM sleep
		WHERE id LIKE $id
		ORDER BY started_at DESC
		LIMIT ${RECORDS_PER_PAGE} OFFSET $offset`,
	);

	return statement
		.all({
			id: id || '%',
			offset: calculateOffset(page),
		})
		.map(row => {
			const started_at = new Date(row.started_at);
			const ended_at = row.ended_at ? new Date(row.ended_at) : null;
			const timeago = TimeAgo.format(started_at);

			let duration = null;
			let durationNumber = 0;

			if (ended_at !== null) {
				// Difference between start and end, in milliseconds
				const diff = ended_at.getTime() - started_at.getTime();
				duration = prettyDuration(diff);
				durationNumber = diff / 3600000;
			}

			return {
				...row,
				timeago,
				duration,
				durationNumber,
				dateFull: prettyDate(ended_at ?? started_at),
				dateShort: shortDate(ended_at ?? started_at),
			};
		});
}

export function countSleepCycles () {
	const statement = getStatement(
		'countSleepCycles',
		'SELECT COUNT(*) as total FROM sleep',
	);

	return statement.get().total;
}


export function deleteSleepCycle (id) {
	const statement = getStatement(
		'deleteSleepCycle',
		'DELETE FROM sleep WHERE id = $id',
	);

	return statement.run({ id });
}

export function updateSleepCycle (id, started_at, ended_at) {
	const statement = getStatement(
		'updateSleepCycle',
		`UPDATE sleep
		SET started_at = $started_at,
		    ended_at = $ended_at
		WHERE id = $id`,
	);

	return statement.run({
		id,
		started_at,
		ended_at: new Date(ended_at || Date.now()).toISOString(),
	});
}
