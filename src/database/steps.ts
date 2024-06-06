import { v4 as uuid } from 'uuid';
import { dayMs, formatDate } from '../lib/formatDate.js';
import { type Parameters, calculateGetParameters } from './constants.js';
import { getStatement } from './database.js';

interface Steps {
	id: string;
	step_count_total: number;
	created_at: string;
	device_id: string;
}

export function insertSteps(steps: Omit<Steps, 'id'>) {
	const statement = getStatement(
		'insertSteps',
		`INSERT INTO steps
		(id, step_count_total, created_at, device_id)
		VALUES
		($id, $step_count_total, $created_at, $device_id)`,
	);

	return statement.run({
		...steps,
		id: uuid(),
		created_at: formatDate(new Date(steps.created_at || Date.now())),
	});
}

export function getSteps(parameters: Partial<Parameters> = {}) {
	const statement = getStatement<Steps>(
		'getSteps',
		`SELECT * FROM steps
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY created_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters));
}

export function getStepsYesterday() {
	const statement = getStatement<Steps>(
		'getStepsYesterday',
		`SELECT * FROM steps
		WHERE DATE(created_at) = $created_at
		LIMIT 1`,
	);

	const yesterday = new Date(Date.now() - dayMs);

	return statement.get({ created_at: formatDate(yesterday) });
}

export function countSteps() {
	const statement = getStatement<{ total: number }>('countSteps', 'SELECT COUNT(*) as total FROM steps');
	return statement.get()?.total || 0;
}

export function deleteSteps(id: string) {
	const statement = getStatement('deleteSteps', 'DELETE FROM steps WHERE id = $id');
	return statement.run({ id });
}

export function updateSteps(steps: Omit<Steps, 'device_id'>) {
	const statement = getStatement(
		'updateSteps',
		`UPDATE steps
		SET step_count_total = $step_count_total,
		    created_at = $created_at
		WHERE id = $id`,
	);

	return statement.run({
		...steps,
		created_at: formatDate(new Date(steps.created_at || Date.now())),
	});
}
