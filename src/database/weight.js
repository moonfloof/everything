import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import { calculateGetParameters } from './constants.js';

export function insertWeight (weight_kgs, created_at, device_id) {
	const statement = getStatement(
		'insertWeight',
		`INSERT INTO weight
		(id, weight_kgs, created_at, device_id)
		VALUES
		($id, $weight_kgs, $created_at, $device_id)`,
	);

	return statement.run({
		id: uuid(),
		weight_kgs,
		created_at: new Date(created_at).toISOString(),
		device_id,
	});
}

/**
 * Fetch weight records
 *
 * @export
 * @param {object} parameters
 * @param {string} [parameters.id]
 * @param {number} [parameters.page]
 * @param {number} [parameters.limit]
 * @param {number} [parameters.days]
 */
export function getWeight (parameters) {
	const statement = getStatement(
		'getWeight',
		`SELECT * FROM weight
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY created_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters));
}

export function countWeight () {
	const statement = getStatement(
		'countWeight',
		'SELECT COUNT(*) as total FROM weight',
	);

	return statement.get().total;
}

export function deleteWeight (id) {
	const statement = getStatement(
		'deleteWeight',
		'DELETE FROM weight WHERE id = $id',
	);

	return statement.run({ id });
}

export function updateWeight (id, weight_kgs, created_at) {
	const statement = getStatement(
		'updateWeight',
		`UPDATE weight
		SET weight_kgs = $weight_kgs,
		    created_at = $created_at
		WHERE id = $id`,
	);

	return statement.run({
		id,
		weight_kgs,
		created_at,
	});
}
