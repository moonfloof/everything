import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import timeago from '../adapters/timeago.js';
import { prettyDuration } from '../lib/formatDate.js';

export function insertNewGameActivity (name, deviceId, playtime = 0) {
	const id = uuid();
	const createdAt = new Date(Date.now() - (playtime * 1000)).toISOString();
	const updatedAt = new Date().toISOString();

	const statement = getStatement(
		'insertGameActivity',
		`INSERT INTO games
		(id, name, playtime_mins, created_at, updated_at, device_id)
		VALUES
		($id, $name, $playtime, $createdAt, $updatedAt, $deviceId)`,
	);

	return statement.run({
		id,
		name,
		playtime,
		createdAt,
		updatedAt,
		deviceId,
	});
}

export function updateActivity (name, playtime, deviceId, intervalDuration) {
	const selectStatement = getStatement(
		'getGameActivityByName',
		`SELECT * FROM games WHERE name = $name
		ORDER BY created_at DESC LIMIT 1;`,
	);

	const row = selectStatement.get({ name });

	if (row === undefined) {
		insertNewGameActivity(name, deviceId, playtime);
		return;
	}

	const lastUpdated = new Date(row.updated_at).getTime();
	const lastCheck = Date.now() - intervalDuration - (playtime * 60000) - 60000;

	if (lastUpdated < lastCheck) {
		insertNewGameActivity(name, deviceId, playtime);
		return;
	}

	const updateStatement = getStatement(
		'updateGameActivity',
		`UPDATE games
		SET playtime_mins = $playtime,
		    updated_at = $updatedAt
		WHERE id = $id`,
	);

	updateStatement.run({
		id: row.id,
		playtime: row.playtime_mins + playtime,
		updatedAt: new Date().toISOString(),
	});
}

/**
 * Fetch all game activity, or based on a specific ID
 *
 * @export
 * @param {string} [id]
 * @param {number} [page]
 */
export function getGameActivity (id, page) {
	const statement = getStatement(
		'getGameActivity',
		`SELECT * FROM games
		WHERE id LIKE $id
		ORDER BY updated_at DESC
		LIMIT 50 OFFSET $offset`,
	);

	return statement
		.all({
			id: id || '%',
			offset: page ? (page - 1) * 50 : 0,
		})
		.map(row => ({
			...row,
			duration: prettyDuration(row.playtime_mins * 60000),
			timeago: timeago.format(new Date(row.updated_at)),
		}));
}
