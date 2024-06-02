import { v4 as uuid } from 'uuid';
import { dayMs, formatDate } from '../lib/formatDate.js';
import { calculateGetParameters } from './constants.js';
import { getStatement } from './database.js';

/**
 * @param {number} step_count_total
 * @param {string} created_at
 * @param {string} device_id
 * @return {import('better-sqlite3').RunResult}
 */
export function insertSteps(step_count_total, created_at, device_id) {
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
		created_at: formatDate(new Date(created_at || Date.now())),
		device_id,
	});
}

/**
 * @export
 * @param {object} parameters
 * @param {string} [parameters.id]
 * @param {number} [parameters.page]
 * @param {number} [parameters.limit]
 * @param {number} [parameters.days]
 */
export function getSteps(parameters) {
	const statement = getStatement(
		'getSteps',
		`SELECT * FROM steps
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY created_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters));
}

export function getStepsYesterday() {
	const statement = getStatement(
		'getStepsYesterday',
		`SELECT * FROM steps
		WHERE DATE(created_at) = $created_at
		LIMIT 1`,
	);

	const yesterday = new Date(Date.now() - dayMs);

	return statement.all({ created_at: formatDate(yesterday) });
}

/** @return {number} */
export function countSteps() {
	const statement = getStatement('countSteps', 'SELECT COUNT(*) as total FROM steps');

	return statement.get().total;
}

/**
 * @param {string} id
 * @return {import('better-sqlite3').RunResult}
 */
export function deleteSteps(id) {
	const statement = getStatement('deleteSteps', 'DELETE FROM steps WHERE id = $id');

	return statement.run({ id });
}

/**
 * @param {string} id
 * @param {number} step_count_total
 * @param {string} created_at
 * @return {import('better-sqlite3').RunResult}
 */
export function updateSteps(id, step_count_total, created_at) {
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
		created_at: formatDate(created_at || Date.now()),
	});
}
