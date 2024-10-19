import { v4 as uuid } from 'uuid';
import { timeago } from '../adapters/timeago.js';
import { dateDefault } from '../lib/formatDate.js';
import type { Insert, Optional } from '../types/database.js';
import { type Parameters, calculateGetParameters } from './constants.js';
import { getStatement } from './database.js';

export interface GameAchievement {
	id: string;
	name: string;
	description: Optional<string>;
	game_name: string;
	game_id: string;
	device_id: string;
	created_at: string;
}

export function insertNewGameAchievement(achievement: Insert<GameAchievement>) {
	const statement = getStatement(
		'insertGameAchievement',
		`INSERT INTO gameachievements
		(id, name, description, game_name, game_id, created_at, updated_at, device_id)
		VALUES
		($id, $name, $description, $game_name, $game_id, $created_at, $updated_at, $device_id)`,
	);

	return statement.run({
		...achievement,
		id: uuid(),
		created_at: dateDefault(achievement.created_at),
		updated_at: new Date().toISOString(),
	});
}

export function getGameAchievement(parameters: Partial<Parameters> = {}) {
	const statement = getStatement<GameAchievement>(
		'getGameAchievement',
		`SELECT * FROM gameachievements
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY updated_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters)).map(row => ({
		...row,
		timeago: timeago.format(new Date(row.created_at)),
	}));
}

export function getGameAchievementsForSession(game_id: string) {
	const statement = getStatement<Pick<GameAchievement, 'id' | 'name' | 'description' | 'created_at'>>(
		'getGameAchievementsForSession',
		`SELECT id, name, description, created_at FROM gameachievements
		WHERE game_id = $game_id
		ORDER BY created_at ASC`,
	);

	return statement.all({ game_id });
}

export function countGameAchievement() {
	const statement = getStatement<{ total: number }>(
		'countGameAchievement',
		'SELECT COUNT(*) as total FROM gameachievements',
	);

	return statement.get()?.total || 0;
}

export function deleteGameAchievement(id: string) {
	const statement = getStatement('deleteGameAchievement', 'DELETE FROM gameachievements WHERE id = $id');

	return statement.run({ id });
}

export function updateGameAchievement(achievement: Omit<GameAchievement, 'device_id' | 'game_name' | 'game_id'>) {
	const statement = getStatement(
		'updateGameAchievement',
		`UPDATE gameachievements
		SET name = $name,
		    description = $description,
		    created_at = $created_at
		WHERE id = $id`,
	);

	return statement.run({
		...achievement,
		created_at: dateDefault(achievement.created_at),
	});
}
