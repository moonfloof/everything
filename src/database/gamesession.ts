import { v4 as uuid } from 'uuid';
import { timeago } from '../adapters/timeago.js';
import {
	dateDefault,
	dayMs,
	getStartOfDay,
	minuteMs,
	msToIsoDuration,
	prettyDuration,
	shortDate,
} from '../lib/formatDate.js';
import type { Insert, Update } from '../types/database.js';
import { type Parameters, calculateGetParameters } from './constants.js';
import { getStatement } from './database.js';
import { type Game, getGameById, selectOrInsertGame } from './game.js';
import { getGameAchievementsForSession } from './gameachievements.js';

export interface GameSessionRaw {
	id: string;
	game_id: number;
	playtime_mins: number;
	created_at: string;
	updated_at: string;
	device_id: string;
}

type GameSessionInsert = Insert<Game & Omit<GameSessionRaw, 'game_id'>>;
type GameSession = Omit<Game, 'id'> & GameSessionRaw;
export type GameSessionInsertResponse = {
	id: string;
	game_id: number;
	changes: number;
	lastInsertRowid: number | bigint;
};

export function insertGameSession(game: GameSessionInsert): GameSessionInsertResponse {
	const gameRecord = selectOrInsertGame(game);

	const id = uuid();
	const statement = getStatement(
		'insertGameSession',
		`INSERT INTO game_session
		(id, game_id, playtime_mins, created_at, updated_at, device_id)
		VALUES
		($id, $game_id, $playtime_mins, $created_at, $updated_at, $device_id)`,
	);

	const created_at = game.created_at
		? dateDefault(game.created_at)
		: new Date(Date.now() - game.playtime_mins * minuteMs).toISOString();

	const result = statement.run({
		...game,
		id,
		game_id: gameRecord.id,
		created_at,
		updated_at: new Date().toISOString(),
	});

	return {
		...result,
		id,
		game_id: gameRecord.id,
	};
}

export function updateGameSession(
	game: Omit<GameSessionInsert, 'created_at'>,
	intervalDurationMs: number,
): GameSessionInsertResponse {
	const gameRecord = selectOrInsertGame(game);

	const selectStatement = getStatement<GameSessionRaw>(
		'getGameSessionByName',
		`SELECT * FROM game_session
		WHERE game_id = $game_id
		ORDER BY created_at DESC LIMIT 1;`,
	);

	const row = selectStatement.get({ game_id: gameRecord.id });

	if (row === undefined) {
		return insertGameSession({ ...game, created_at: '' });
	}

	const lastUpdated = new Date(row.updated_at || Date.now()).getTime();
	const lastCheck = Date.now() - intervalDurationMs - game.playtime_mins * minuteMs - minuteMs;

	if (lastUpdated < lastCheck) {
		return insertGameSession({ ...game, created_at: '' });
	}

	const updateStatement = getStatement(
		'updateGameSession',
		`UPDATE game_session
		SET playtime_mins = $playtime_mins,
		    updated_at = $updated_at
		WHERE id = $id`,
	);

	const result = updateStatement.run({
		id: row.id,
		playtime_mins: row.playtime_mins + game.playtime_mins,
		updated_at: new Date().toISOString(),
	});

	return {
		...result,
		id: row.id,
		game_id: gameRecord.id,
	};
}

export function getGameSessions(parameters: Parameters = {}) {
	const statement = getStatement<GameSession & { perfectedSession: boolean }>(
		'getGameSessions',
		`SELECT
			s.*, g.name, g.url,
			(SELECT a.unlocked_session_id FROM game_achievements AS a WHERE a.game_id = s.game_id GROUP BY a.unlocked_session_id ORDER BY a.unlocked_session_id IS NOT NULL, a.updated_at DESC LIMIT 1) = s.id AS perfectedSession
		FROM game_session AS s
		JOIN games AS g ON g.id = s.game_id
		WHERE s.id LIKE $id AND s.created_at >= $created_at
		ORDER BY s.updated_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters)).map(row => {
		const achievements = getGameAchievementsForSession(row.id);
		const achievementText = achievements.length === 1 ? 'achievement' : 'achievements';

		return {
			...row,
			duration: prettyDuration(row.playtime_mins * minuteMs),
			durationNumber: row.playtime_mins / 60,
			durationIso: msToIsoDuration(row.playtime_mins * minuteMs),
			timeago: timeago.format(new Date(row.created_at)),
			achievements,
			achievementText,
		};
	});
}

export function getGameSessionsByDay(days = 7) {
	const statement = getStatement<GameSession>(
		'getGameSessionsByDay',
		`SELECT s.*, g.name, g.url FROM game_session AS s
		JOIN games AS g ON g.id = s.game_id
		WHERE s.created_at >= $created_at
		ORDER BY s.updated_at DESC`,
	);

	return statement
		.all({
			created_at: new Date(Date.now() - days * dayMs).toISOString(),
		})
		.map(row => ({
			...row,
			duration: prettyDuration(row.playtime_mins * minuteMs),
			durationNumber: row.playtime_mins / 60,
			timeago: timeago.format(new Date(row.created_at)),
		}));
}

export function getGameSessionsGroupedByDay(days = 14) {
	const daysAgo = new Date(Date.now() - days * dayMs);
	const created_at = getStartOfDay(daysAgo).toISOString();

	const statement = getStatement<{ day: string; playtime_mins: number }>(
		'getGameSessionsGroupedByDay',
		`SELECT
			DATE(created_at) as day,
			SUM(playtime_mins) as playtime_mins
		FROM game_session
		WHERE created_at >= $created_at
		GROUP BY day
		ORDER BY day DESC`,
	);

	return statement.all({ created_at }).map(row => ({
		...row,
		day: new Date(row.day),
		y: row.playtime_mins / 60,
		label: shortDate(new Date(row.day)),
	}));
}

export function getGameStats(days = 14) {
	const daysAgo = new Date(Date.now() - days * dayMs);
	const created_at = getStartOfDay(daysAgo).toISOString();

	const stats = getStatement<{
		totalPlaytime: number;
		favouriteGameId: number;
		achievementsUnlocked: number;
	}>(
		'getGameStatsPlaytime',
		`SELECT
			(SELECT SUM(playtime_mins)*60000 FROM game_session AS s WHERE created_at >= $created_at) AS totalPlaytime,
			(SELECT g.id FROM game_session AS s JOIN games AS g ON g.id = s.game_id WHERE created_at >= $created_at GROUP BY g.name ORDER BY SUM(s.playtime_mins) DESC LIMIT 1) AS favouriteGameId,
			(SELECT COUNT(unlocked_session_id) FROM game_achievements WHERE unlocked_session_id IS NOT NULL AND updated_at >= $created_at) AS achievementsUnlocked`,
	).get({ created_at });

	if (!stats) return undefined;

	const favouriteGame = getGameById(stats.favouriteGameId);

	return {
		...stats,
		favouriteGame,
		totalPlaytimeHuman: prettyDuration(stats.totalPlaytime),
	};
}

export function countGameSessions() {
	const statement = getStatement<{ total: number }>('countGameSessions', 'SELECT COUNT(*) as total FROM games');
	return statement.get()?.total || 0;
}

export function deleteGameSession(id: string) {
	return getStatement('deleteGameSession', 'DELETE FROM game_session WHERE id = $id').run({ id });
}

export function updateGameSessionInternal(game: Update<Omit<Game, 'id'> & GameSessionRaw>) {
	const gameRecord = selectOrInsertGame(game);

	const statement = getStatement(
		'updateGameSessionInternal',
		`UPDATE game_session
		SET game_id = $game_id,
		    playtime_mins = $playtime_mins,
		    created_at = $created_at,
		    updated_at = $updated_at
		WHERE id = $id`,
	);

	return statement.run({
		id: game.id,
		game_id: gameRecord.id,
		playtime_mins: Number(game.playtime_mins),
		created_at: dateDefault(game.created_at),
		updated_at: dateDefault(game.updated_at),
	});
}

export function getPopularGames(days: number, limit = 10) {
	const statement = getStatement<{
		id: number;
		name: string;
		last_played: string;
		session_id: string;
		playtime_hours: number;
		achievements_unlocked: number;
		achievements_total: number;
		achievements_unlocked_in_time: number;
	}>(
		'getPopularGames',
		`SELECT
			g.id AS id, g.name AS name,
			MAX(s.updated_at) AS last_played,
			s.id AS session_id,
			CEIL(SUM(s.playtime_mins) / 60.0) AS playtime_hours,
			(SELECT COUNT(id) FROM game_achievements AS a WHERE a.game_id = g.id AND a.unlocked_session_id IS NOT NULL AND updated_at >= $created_at) AS achievements_unlocked_in_time,
			(SELECT COUNT(id) FROM game_achievements AS a WHERE a.game_id = g.id AND a.unlocked_session_id IS NOT NULL) AS achievements_unlocked,
			(SELECT COUNT(id) FROM game_achievements AS a WHERE a.game_id = g.id) AS achievements_total
		FROM game_session AS s
		JOIN games AS g ON g.id = s.game_id
		WHERE created_at >= $created_at
		GROUP BY name
		ORDER BY playtime_hours DESC, name ASC
		LIMIT $limit`,
	);

	const created_at = new Date(Date.now() - days * dayMs).toISOString();
	const rows = statement.all({ created_at, limit });

	const topGame = rows[0];

	if (topGame === undefined) {
		return [];
	}

	return rows.map(row => ({
		...row,
		achievement_percentage: Math.round((row.achievements_unlocked / row.achievements_total) * 100),
		perfected: row.achievements_unlocked === row.achievements_total,
		popularityPercentage: (row.playtime_hours / topGame.playtime_hours) * 100,
		timeago: timeago.format(new Date(row.last_played)),
	}));
}

// The same output format as the function above, but it retrieves the data based
// on the achievements table first, which reduces the query from about 300ms, to
// 20ms!
export function getAllPerfectedGames() {
	type PerfectGame = {
		id: number;
		name: string;
		last_played: string;
		session_id: string;
		playtime_hours: number;
		perfected: 1;
		achievement_percentage: 100;
		achievements_unlocked: number;
		achievements_total: number;
		achievements_unlocked_in_time: number;
		last_achieved: number;
	};

	const games = getStatement<PerfectGame>(
		'getAllPerfectedGames',
		`SELECT
			g.id AS id, g.name AS name,
			(SELECT CEIL(SUM(playtime_mins) / 60.0) FROM game_session AS s WHERE s.game_id = g.id) AS playtime_hours,
			(SELECT updated_at FROM game_session AS s WHERE s.game_id = g.id ORDER BY updated_at DESC LIMIT 1) AS last_played,
			(SELECT id FROM game_session AS s WHERE s.game_id = g.id ORDER BY updated_at DESC LIMIT 1) AS session_id,
			COUNT(unlocked_session_id) AS achievements_unlocked,
			COUNT(unlocked_session_id) AS achievements_unlocked_in_time,
			COUNT(*) AS achievements_total,
			MAX(a.updated_at) as last_achieved,
			1 as perfected,
			100 as achievement_percentage
		FROM game_achievements AS a
		JOIN games AS g ON g.id = a.game_id
		GROUP BY g.name
		HAVING achievements_unlocked = achievements_total
		ORDER BY last_achieved DESC;`,
	).all();

	if (games.length === 0 || games[0] === undefined) return [];

	const longestGame: PerfectGame = games.reduce(
		(longest, game) => (game.playtime_hours > longest.playtime_hours ? game : longest),
		games[0],
	);

	return games.map(row => ({
		...row,
		popularityPercentage: (row.playtime_hours / longestGame.playtime_hours) * 100,
		timeago: timeago.format(new Date(row.last_played)),
	}));
}
