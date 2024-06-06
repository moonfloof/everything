import { v4 as uuid } from 'uuid';
import { dateDefault } from '../lib/formatDate.js';
import { type Parameters, calculateGetParameters } from './constants.js';
import { getStatement } from './database.js';

interface Weight {
	id: string;
	weight_kgs: number;
	created_at: string;
	device_id: string;
}

export function insertWeight(weight: Omit<Weight, 'id'>) {
	const statement = getStatement(
		'insertWeight',
		`INSERT INTO weight
		(id, weight_kgs, created_at, device_id)
		VALUES
		($id, $weight_kgs, $created_at, $device_id)`,
	);

	return statement.run({
		...weight,
		id: uuid(),
		created_at: dateDefault(weight.created_at),
	});
}

export function getWeight(parameters: Partial<Parameters> = {}) {
	const statement = getStatement<Weight>(
		'getWeight',
		`SELECT * FROM weight
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY created_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters));
}

export function countWeight() {
	const statement = getStatement<{ total: number }>('countWeight', 'SELECT COUNT(*) as total FROM weight');

	return statement.get()?.total || 0;
}

export function deleteWeight(id: string) {
	const statement = getStatement('deleteWeight', 'DELETE FROM weight WHERE id = $id');

	return statement.run({ id });
}

export function updateWeight(weight: Omit<Weight, 'device_id'>) {
	const statement = getStatement(
		'updateWeight',
		`UPDATE weight
		SET weight_kgs = $weight_kgs,
		    created_at = $created_at
		WHERE id = $id`,
	);

	return statement.run({
		...weight,
		created_at: dateDefault(weight.created_at),
	});
}
