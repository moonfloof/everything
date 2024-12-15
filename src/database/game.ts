import type { Insert, Optional } from '../types/database.js';
import { type Parameters, calculateGetParameters } from './constants.js';
import { getStatement } from './database.js';
import { getGameAchievementsForSession, type GameAchievement } from './gameachievements.js';
import type { GameSessionRaw } from './gamesession.js';

export interface Game {
	id: number;
	name: string;
	url: Optional<string>;
}

export function selectOrInsertGame(search: Insert<Game>): Game {
	const select = getStatement<Game>('selectGame', 'SELECT * FROM games WHERE name = $name LIMIT 1;').get(search);

	if (select) {
		return select;
	}

	const game = getStatement<Game>(
		'upsertGame',
		`INSERT INTO games
			(name, url)
		VALUES
			($name, $url)
		ON CONFLICT
		DO UPDATE SET url = $url
		RETURNING *;`,
	).get(search);

	if (!game) {
		throw new Error(`Could not successfully insert new game '${search.name}'`);
	}

	return game;
}

export function countGames(): number {
	const count =
		getStatement<{ count: number }>('countAllGames', 'SELECT COUNT(*) AS count FROM games;').get()?.count ??
		0;

	return count;
}

export function getGames(parameters: Partial<Parameters> = {}) {
	const statement = getStatement<Game & { achievements: number; sessions: number }>(
		'getGames',
		`SELECT
			g.id, g.name, g.url,
			(SELECT COUNT(*) FROM game_session WHERE game_id = g.id) as sessions,
			(SELECT COUNT(*) FROM game_achievements WHERE game_id = g.id) as achievements
		FROM games AS g
		WHERE g.id LIKE $id
		ORDER BY rowid DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters));
}

export function getSessionsForGame(game_id: number): GameSessionRaw[] {
	return getStatement<GameSessionRaw>(
		'getSessionsForGame',
		`SELECT * FROM game_session
		WHERE game_id = $game_id
		ORDER BY created_at DESC`,
	)
		.all({ game_id })
		.map(session => {
			const achievements = getGameAchievementsForSession(session.id);
			const achievementText = achievements.length === 1 ? 'achievement' : 'achievements';
			return {
				...session,
				achievements,
				achievementText,
			};
		});
}

export function getAchievementsForGame(game_id: number): GameAchievement[] {
	return getStatement<GameAchievement>(
		'getAchievementsForGame',
		`SELECT * FROM game_achievements
		WHERE game_id = $game_id
		ORDER BY created_at DESC`,
	).all({ game_id });
}

/**
 * ! WARNING:
 * All records associated with this game will be deleted,
 * including sessions and achievements
 */
export function deleteGameEntirely(game_id: number) {
	return getStatement('deleteGameEntirely', 'DELETE FROM games WHERE id = $game_id').run({ game_id });
}

export function updateGame(game: Game) {
	return getStatement(
		'updateGame',
		`UPDATE games
		SET name = $name,
		    url = $url
		WHERE id = $id`,
	).run(game);
}

export function getGamesAsOptions() {
	return getStatement<{ value: string; label: string }>(
		'getGamesAsOptions',
		'SELECT id AS value, name AS label FROM games ORDER BY name ASC',
	).all();
}
