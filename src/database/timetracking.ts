import { v4 as uuid } from 'uuid';
import { dateDefault } from '../lib/formatDate.js';
import type { Insert, Optional, Update } from '../types/database.js';
import { type Parameters, calculateGetParameters } from './constants.js';
import { getStatement } from './database.js';

export interface Timetracking {
	id: string;
	category: string;
	created_at: string;
	ended_at: Optional<string>;
	device_id: string;
}

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
} as const;

export const categoryValues = Object.values(CATEGORIES);

function insertNewRecord(session: Insert<Timetracking>) {
	const statement = getStatement(
		'insertTimeTracking',
		`INSERT INTO timetracking
		(id, category, created_at, ended_at, device_id)
		VALUES
		($id, $category, $created_at, $ended_at, $device_id)`,
	);

	return statement.run({
		...session,
		id: uuid(),
		created_at: dateDefault(session.created_at),
		ended_at: session.ended_at ? new Date(session.ended_at).toISOString() : null,
	});
}

function endTimeTrackingSession(id: string, ended_at: string) {
	const updateStatement = getStatement(
		'endTimeTrackingSession',
		`UPDATE timetracking
		SET ended_at = $ended_at
		WHERE id = $id`,
	);

	updateStatement.run({
		id,
		ended_at: dateDefault(ended_at),
	});
}

export function insertTimeTracking(session: Insert<Timetracking>) {
	const selectStatement = getStatement<Pick<Timetracking, 'id'>>(
		'selectTimeTracking',
		`SELECT id FROM timetracking
		WHERE ended_at IS NULL
		ORDER BY created_at DESC
		LIMIT 1`,
	);

	// End the previous event, if there is one unfinished
	const eventWithoutEnd = selectStatement.get();
	if (eventWithoutEnd && !session.ended_at) {
		endTimeTrackingSession(eventWithoutEnd.id, session.created_at);
	}

	if (session.category.toLowerCase().startsWith('stop')) return;

	insertNewRecord(session);
}

export function getTimeTracking(parameters: Partial<Parameters> = {}) {
	const statement = getStatement(
		'getTimeTracking',
		`SELECT * FROM timetracking
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY created_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters));
}

export function countTimeTracking() {
	const statement = getStatement<{ total: number }>(
		'countTimeTracking',
		'SELECT COUNT(*) as total FROM timetracking',
	);

	return statement.get()?.total || 0;
}

export function deleteTimeTracking(id: string) {
	const statement = getStatement('deleteTimeTracking', 'DELETE FROM timetracking WHERE id = $id');
	return statement.run({ id });
}

export function updateTimeTracking(session: Update<Timetracking>) {
	if (session.category?.toLowerCase().startsWith('stop')) {
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
		...session,
		created_at: dateDefault(session.created_at),
		ended_at: dateDefault(session.ended_at),
	});
}
