import { v4 as uuid } from 'uuid';
import { dateDefault } from '../lib/formatDate.js';
import { type Parameters, calculateGetParameters } from './constants.js';
import { getStatement } from './database.js';

interface Food {
	id: string;
	name: string;
	type: string;
	created_at: string;
	device_id: string;
}

export function insertFood(food: Omit<Food, 'id'>) {
	const statement = getStatement(
		'insertFood',
		`INSERT INTO food
		(id, name, type, created_at, device_id)
		VALUES
		($id, $name, $type, $created_at, $device_id)`,
	);

	return statement.run({
		...food,
		id: uuid(),
		created_at: dateDefault(food.created_at),
	});
}

export function getFood(parameters: Partial<Parameters> = {}) {
	const statement = getStatement<Food>(
		'getFood',
		`SELECT * FROM food
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY created_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters));
}

export function countFood() {
	const statement = getStatement<{ total: number }>('countFood', 'SELECT COUNT(*) as total FROM food');
	return statement.get()?.total || 0;
}

export function deleteFood(id: string) {
	const statement = getStatement('deleteFood', 'DELETE FROM food WHERE id = $id');
	return statement.run({ id });
}

export function updateFood(food: Omit<Food, 'device_id'>) {
	const statement = getStatement(
		'updateFood',
		`UPDATE food
		SET name = $name,
		    type = $type,
		    created_at = $created_at
		WHERE id = $id`,
	);

	return statement.run({
		...food,
		created_at: dateDefault(food.created_at),
	});
}
