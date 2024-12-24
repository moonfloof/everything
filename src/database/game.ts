import { existsSync } from 'node:fs';
import { timeago } from '../adapters/timeago.js';
import { deleteIfExists, getImagePath } from '../lib/mediaFiles.js';
import type { Insert, Optional } from '../types/database.js';
import { type Parameters, calculateGetParameters } from './constants.js';
import { getStatement } from './database.js';
import { type GameAchievement, getGameAchievementsForSession } from './gameachievements.js';
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

function getGameAssets(id: number) {
	const hasHeroImage = existsSync(getImagePath('game', `hero-${id}`));
	const hasPosterImage = existsSync(getImagePath('game', `library-${id}`));

	return {
		heroUrl: hasHeroImage ? `/game-images/hero-${id}.avif` : null,
		posterUrl: hasPosterImage ? `/game-images/library-${id}.avif` : null,
	};
}

export function getGameById(id: string | number) {
	const game = getStatement<Game>('getGameById', 'SELECT * FROM games WHERE id = $id LIMIT 1;').get({ id });
	if (!game) return undefined;

	return {
		...game,
		...getGameAssets(game.id),
	};
}

export function getSessionsForGame(game_id: number, order: 'DESC' | 'ASC' = 'DESC'): GameSessionRaw[] {
	return getStatement<GameSessionRaw>(
		`getSessionsForGame-${order}`,
		`SELECT * FROM game_session
		WHERE game_id = $game_id
		ORDER BY created_at ${order}`,
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

export function getAchievementsForGame(game_id: number) {
	return getStatement<GameAchievement>(
		'getAchievementsForGame',
		`SELECT * FROM game_achievements
		WHERE game_id = $game_id
		ORDER BY unlocked_session_id IS NULL, updated_at DESC`,
	)
		.all({ game_id })
		.map(achievement => ({
			...achievement,
			timeago: timeago.format(new Date(achievement.updated_at)),
		}));
}

/**
 * ! WARNING:
 * All records associated with this game will be deleted,
 * including sessions and achievements
 */
export function deleteGameEntirely(game_id: number) {
	const result = getStatement('deleteGameEntirely', 'DELETE FROM games WHERE id = $game_id').run({ game_id });
	if (result.changes > 0) {
		deleteIfExists('game', `hero-${game_id}`);
		deleteIfExists('game', `library-${game_id}`);
	}
	return result;
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

export function getGameAndTotalPlaytime(game_id: number) {
	const game = getStatement<Game & { last_played: string; playtime_hours: number }>(
		'getGameAndTotalPlaytime',
		`SELECT
			g.id, g.name, g.url,
			MAX(s.updated_at) AS last_played,
			ROUND((SELECT SUM(s.playtime_mins) FROM game_session AS s WHERE s.game_id = g.id) / 60.0, 1) AS playtime_hours
		FROM games AS g
		JOIN game_session AS s ON s.game_id = g.id
		WHERE g.id = $game_id
		GROUP BY g.id
		LIMIT 1;`,
	).get({ game_id });

	if (!game) return null;

	return {
		...game,
		...getGameAssets(game.id),
		timeago: timeago.format(new Date(game.last_played)),
	};
}
