import { v4 as uuid } from 'uuid';
import { timeago } from '../adapters/timeago.js';
import { dateDefault } from '../lib/formatDate.js';
import type { Optional } from '../types/database.js';
import { calculateGetParameters, type Parameters } from './constants.js';
import { getStatement } from './database.js';

export interface GameAchievement {
	id: string;
	game_id: number;
	unlocked_session_id: Optional<string>;
	name: string;
	description: Optional<string>;
	apiname: Optional<string>;
	created_at: string;
	updated_at: string;
}

export function insertNewGameAchievement(achievement: Omit<GameAchievement, 'id'>) {
	const statement = getStatement(
		'insertGameAchievement',
		`INSERT INTO game_achievements
		(id, game_id, unlocked_session_id, apiname, name, description, created_at, updated_at)
		VALUES
		($id, $game_id, $unlocked_session_id, $apiname, $name, $description, $created_at, $updated_at)`,
	);

	return statement.run({
		...achievement,
		id: uuid(),
		created_at: dateDefault(achievement.created_at),
		updated_at: dateDefault(achievement.updated_at),
	});
}

export function getGameAchievement(parameters: Parameters = {}) {
	const statement = getStatement<GameAchievement>(
		'getGameAchievement',
		`SELECT * FROM game_achievements
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY updated_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters)).map(row => ({
		...row,
		timeago: timeago.format(new Date(row.created_at)),
	}));
}

export function getGameAchievementsForSession(unlocked_session_id: string) {
	const statement = getStatement<Omit<GameAchievement, 'unlocked_session_id'>>(
		'getGameAchievementsForSession',
		`SELECT id, name, description, apiname, game_id, created_at, updated_at FROM game_achievements
		WHERE unlocked_session_id = $unlocked_session_id
		ORDER BY updated_at DESC`,
	);

	return statement.all({ unlocked_session_id });
}

export function countGameAchievement() {
	const statement = getStatement<{ total: number }>(
		'countGameAchievement',
		'SELECT COUNT(*) as total FROM game_achievements',
	);

	return statement.get()?.total || 0;
}

export function deleteGameAchievement(id: string) {
	return getStatement('deleteGameAchievement', 'DELETE FROM game_achievements WHERE id = $id').run({ id });
}

export function updateGameAchievement(achievement: Omit<GameAchievement, 'game_id'>) {
	const statement = getStatement(
		'updateGameAchievement',
		`UPDATE game_achievements
		SET name = $name,
		    unlocked_session_id = $unlocked_session_id,
		    description = $description,
		    created_at = $created_at,
		    updated_at = $updated_at,
		    apiname = $apiname
		WHERE id = $id`,
	);

	return statement.run({
		...achievement,
		created_at: dateDefault(achievement.created_at),
		updated_at: dateDefault(achievement.updated_at),
	});
}
