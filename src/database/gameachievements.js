import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import timeago from '../adapters/timeago.js';
import { isoDuration, minuteMs, prettyDuration } from '../lib/formatDate.js';
import { calculateGetParameters } from './constants.js';

export function insertNewGameAchievement (name, description, game_name, game_id, device_id, created_at) {
	const id = uuid();

	const statement = getStatement(
		'insertGameAchievement',
		`INSERT INTO gameachievements
		(id, name, description, game_name, game_id, created_at, updated_at, device_id)
		VALUES
		($id, $name, $description, $game_name, $game_id, $created_at, $updated_at, $device_id)`,
	);

	return statement.run({
		id,
		name,
		description,
		game_name,
		game_id,
		created_at: new Date(created_at || Date.now()).toISOString(),
		updated_at: new Date().toISOString(),
		device_id,
	});
}

/**
 * Fetch all game achievements, or based on a specific ID
 *
 * @export
 * @param {object} parameters
 * @param {string} [parameters.id]
 * @param {number} [parameters.page]
 * @param {number} [parameters.limit]
 * @param {number} [parameters.days]
 */
export function getGameAchievement (parameters) {
	const statement = getStatement(
		'getGameAchievement',
		`SELECT * FROM gameachievements
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY updated_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement
		.all(calculateGetParameters(parameters))
		.map(row => ({
			...row,
			duration: prettyDuration(row.playtime_mins * minuteMs),
			durationNumber: row.playtime_mins / 60,
			durationIso: isoDuration(row.playtime_mins * minuteMs),
			timeago: timeago.format(new Date(row.created_at)),
		}));
}

export function getGameAchievementsForSession (game_id) {
	const statement = getStatement(
		'getGameAchievementsForSession',
		`SELECT id, name, description, created_at FROM gameachievements
		WHERE game_id = $game_id
		ORDER BY created_at ASC`,
	);

	return statement.all({ game_id });
}

export function countGameAchievement () {
	const statement = getStatement(
		'countGameAchievement',
		'SELECT COUNT(*) as total FROM gameachievements',
	);

	return statement.get().total;
}

export function deleteGameAchievement (id) {
	const statement = getStatement(
		'deleteGameAchievement',
		'DELETE FROM gameachievements WHERE id = $id',
	);

	return statement.run({ id });
}

export function updateGameAchievement (id, name, description, created_at) {
	const statement = getStatement(
		'updateGameAchievement',
		`UPDATE gameachievements
		SET name = $name,
		    description = $description,
		    created_at = $created_at,
		WHERE id = $id`,
	);

	return statement.run({
		id,
		name,
		description,
		created_at,
	});
}
