import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import { calculateOffset, RECORDS_PER_PAGE } from './constants.js';
import { dayMs, formatDate } from '../lib/formatDate.js';

export function insertSteps (step_count_total, created_at, device_id) {
	const statement = getStatement(
		'insertSteps',
		`INSERT INTO steps
		(id, step_count_total, created_at, device_id)
		VALUES
		($id, $step_count_total, $created_at, $device_id)`,
	);

	return statement.run({
		id: uuid(),
		step_count_total,
		created_at: formatDate(new Date(created_at)),
		device_id,
	});
}

/**
 * @export
 * @param {string} [id]
 * @param {number} [page]
 */
export function getSteps (id, page) {
	const statement = getStatement(
		'getSteps',
		`SELECT * FROM steps
		WHERE id LIKE $id
		ORDER BY created_at DESC
		LIMIT ${RECORDS_PER_PAGE} OFFSET $offset`,
	);

	return statement
		.all({
			id: id || '%',
			offset: calculateOffset(page),
		});
}

export function getStepsYesterday () {
	const statement = getStatement(
		'getStepsYesterday',
		`SELECT * FROM steps
		WHERE DATE(created_at) = $created_at
		LIMIT 1`,
	);

	const yesterday = new Date(Date.now() - dayMs);

	return statement.all({ created_at: formatDate(yesterday) });
}

export function countSteps () {
	const statement = getStatement(
		'countSteps',
		'SELECT COUNT(*) as total FROM steps',
	);

	return statement.get().total;
}

export function deleteSteps (id) {
	const statement = getStatement(
		'deleteSteps',
		'DELETE FROM steps WHERE id = $id',
	);

	return statement.run({ id });
}

export function updateSteps (id, step_count_total, created_at) {
	const statement = getStatement(
		'updateSteps',
		`UPDATE steps
		SET step_count_total = $step_count_total,
		    created_at = $created_at
		WHERE id = $id`,
	);

	return statement.run({
		id,
		step_count_total,
		created_at,
	});
}
