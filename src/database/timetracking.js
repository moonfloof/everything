import { v4 as uuid } from 'uuid';
import { calculateGetParameters } from './constants.js';
import { getStatement } from './database.js';

export const CATEGORIES = {
	STOP: 'Stop Current',
	TOILET: 'Toilet',
	COOKING: 'Cooking/Eating',
	WORK: 'Work',
	LEISURE: 'Leisure',
	PRODUCTIVE: 'Productive',
	DISTRACTION: 'Distraction',
	SOCIAL: 'Social',
	HYGIENE: 'Hygiene',
	HOUSEWORK: 'Housework',
	EXERCISE: 'Exercise',
	TRAVEL: 'Travel',
	MEETING: 'Meeting',
	SLEEP: 'Sleep',
	NAP: 'Nap',
};

export const categoryValues = Object.values(CATEGORIES);

/**
 * @param {string} category
 * @param {string} created_at
 * @param {string} ended_at
 * @param {string} device_id
 * @returns {import('better-sqlite3').RunResult}
 */
function insertNewRecord(category, created_at, ended_at, device_id) {
	const statement = getStatement(
		'insertTimeTracking',
		`INSERT INTO timetracking
		(id, category, created_at, ended_at, device_id)
		VALUES
		($id, $category, $created_at, $ended_at, $device_id)`,
	);

	return statement.run({
		id: uuid(),
		category,
		created_at: new Date(created_at || Date.now()).toISOString(),
		ended_at: ended_at ? new Date(ended_at).toISOString() : null,
		device_id,
	});
}

/**
 * @param {string} id
 * @param {string} ended_at
 * @returns {import('better-sqlite3').RunResult}
 */
function endTimeTrackingSession(id, ended_at) {
	const updateStatement = getStatement(
		'endTimeTrackingSession',
		`UPDATE timetracking
		SET ended_at = $ended_at
		WHERE id = $id`,
	);

	updateStatement.run({
		id,
		ended_at: new Date(ended_at || Date.now()).toISOString(),
	});
}

/**
 * @export
 * @param {string} category
 * @param {string} created_at
 * @param {string} ended_at
 * @param {string} device_id
 * @return {void}
 */
export function insertTimeTracking(category, created_at, ended_at, device_id) {
	const selectStatement = getStatement(
		'selectTimeTracking',
		`SELECT id FROM timetracking
		WHERE ended_at IS NULL
		ORDER BY created_at DESC
		LIMIT 1`,
	);

	// End the previous event, if there is one unfinished
	const eventWithoutEnd = selectStatement.get();
	if (eventWithoutEnd && !ended_at) {
		endTimeTrackingSession(eventWithoutEnd.id, created_at);
	}

	if (category.toLowerCase().startsWith('stop')) return;

	insertNewRecord(category, created_at, ended_at, device_id);
}

/**
 * @param {object} parameters
 * @param {string} [parameters.id]
 * @param {number} [parameters.page]
 * @param {number} [parameters.limit]
 * @param {number} [parameters.days]
 */
export function getTimeTracking(parameters) {
	const statement = getStatement(
		'getTimeTracking',
		`SELECT * FROM timetracking
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY created_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters));
}

/** @return {number} */
export function countTimeTracking() {
	const statement = getStatement('countTimeTracking', 'SELECT COUNT(*) as total FROM timetracking');

	return statement.get().total;
}

/**
 * @param {string} id
 * @returns {import('better-sqlite3').RunResult}
 */
export function deleteTimeTracking(id) {
	const statement = getStatement('deleteTimeTracking', 'DELETE FROM timetracking WHERE id = $id');

	return statement.run({ id });
}

/**
 * @param {string} id
 * @param {string} category
 * @param {string} created_at
 * @param {string} ended_at
 * @returns {import('better-sqlite3').RunResult}
 */
export function updateTimeTracking(id, category, created_at, ended_at) {
	if (category?.toLowerCase().startsWith('stop')) {
		return;
	}

	const statement = getStatement(
		'updateTimeTracking',
		`UPDATE timetracking
		SET category = $category,
		    created_at = $created_at,
		    ended_at = $ended_at
		WHERE id = $id`,
	);

	return statement.run({
		id,
		category,
		created_at: new Date(created_at || Date.now()).toISOString(),
		ended_at: new Date(ended_at || Date.now()).toISOString(),
	});
}
