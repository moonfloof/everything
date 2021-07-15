import { v4 as uuid } from 'uuid';
import { getDatabase } from './getDatabase.js';
import timeago from '../adapters/timeago.js';

export async function insertNewGameActivity (name, deviceId, playtime = 0) {
	const db = await getDatabase();

	const id = uuid();
	const timestamp = new Date().toISOString();

	const statement = await db.prepare(`
		INSERT INTO games
		(id, name, playtime_mins, created_at, updated_at, device_id)
		VALUES
		($id, $name, $playtime, $createdAt, $updatedAt, $deviceId)
	`);

	await statement.bind({
		$id: id,
		$name: name,
		$playtime: playtime,
		$createdAt: timestamp,
		$updatedAt: timestamp,
		$deviceId: deviceId,
	});

	return statement.run();
}

export async function updateActivity (name, playtime, deviceId, intervalDuration) {
	const db = await getDatabase();

	const selectStatement = await db.prepare(`
		SELECT * FROM games WHERE name = $name
		ORDER BY created_at DESC LIMIT 1;
	`);

	await selectStatement.bind({
		$name: name,
	});

	const row = await selectStatement.get();

	if (row === undefined) {
		insertNewGameActivity(name, deviceId, playtime);
		return;
	}

	const lastUpdated = new Date(row.updated_at).getTime();
	const lastCheck = Date.now() - intervalDuration - (playtime * 1000) - 60000;

	if (lastUpdated < lastCheck) {
		await insertNewGameActivity(name, deviceId, playtime);
		return;
	}

	const updateStatement = await db.prepare(`
		UPDATE games
		SET playtime_mins = $playtime,
		    updated_at = $updatedAt
		WHERE id = $id
	`);

	await updateStatement.bind({
		$id: row.id,
		$playtime: row.playtime_mins + playtime,
		$updatedAt: new Date().toISOString(),
	});

	await updateStatement.run();
}

/**
 * Fetch all game activity, or based on a specific ID
 *
 * @export
 * @param {string} [id]
 * @param {number} [page]
 */
export async function getGameActivity (id, page) {
	const db = await getDatabase();

	const statement = await db.prepare(`
		SELECT * FROM games
		WHERE id LIKE $id
		ORDER BY updated_at DESC
		LIMIT 50 OFFSET $offset
	`);

	await statement.bind({
		$id: id || '%',
		$offset: page ? (page - 1) * 50 : 0,
	});

	return statement
		.all()
		.then(rows => rows.map(row => ({
			...row,
			timeago: timeago.format(new Date(row.updated_at)),
		})));
}
