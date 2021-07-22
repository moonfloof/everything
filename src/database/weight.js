import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import TimeAgo from '../adapters/timeago.js';

export function insertWeight (weightKgs, createdAt, deviceId) {
	const statement = getStatement(
		'insertWeight',
		`INSERT INTO weight
		(id, weight_kgs, created_at, device_id)
		VALUES
		($id, $weightKgs, $createdAt, $deviceId)`,
	);

	return statement.run({
		id: uuid(),
		weightKgs,
		createdAt: new Date(createdAt).toISOString(),
		deviceId,
	});
}

/**
 * @export
 * @param {string} [id]
 * @param {number} [page]
 */
export function getWeight (id, page) {
	const statement = getStatement(
		'getWeight',
		`SELECT * FROM weight
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
			timeago: TimeAgo.format(row.created_at),
		}));
}
