import { v4 as uuid } from 'uuid';
import { timeago } from '../adapters/timeago.js';
import {
	dateDefault,
	dayMs,
	getStartOfDay,
	isoDuration,
	minuteMs,
	prettyDuration,
	shortDate,
} from '../lib/formatDate.js';
import type { Insert, Update } from '../types/database.js';
import { type Parameters, calculateGetParameters } from './constants.js';
import { getStatement } from './database.js';
import { type Game, selectOrInsertGame } from './game.js';
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

interface GameStats {
	totalPlaytime: number;
	games: Record<string, number>;
	averagePlaytime: string;
	totalSessions: number;
	totalPlaytimeHuman: string;
	favouriteGame: string;
}

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

export function getGameSessions(parameters: Partial<Parameters> = {}) {
	const statement = getStatement<GameSession>(
		'getGameSessions',
		`SELECT s.*, g.name, g.url FROM game_session AS s
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
			durationIso: isoDuration(row.playtime_mins * minuteMs),
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

export function getGameStats() {
	const emptyStats: GameStats = {
		totalPlaytime: 0,
		games: {},
		averagePlaytime: '',
		totalSessions: 0,
		totalPlaytimeHuman: '',
		favouriteGame: '',
	};

	const games = getGameSessionsByDay(7);

	if (games.length === 0) {
		return null;
	}

	const stats = games.reduce((stats, cur) => {
		stats.games[cur.name] =
			stats.games[cur.name] === undefined
				? cur.playtime_mins
				: stats.games[cur.name] + cur.playtime_mins;

		stats.totalPlaytime += cur.playtime_mins;

		return stats;
	}, emptyStats);

	stats.averagePlaytime = prettyDuration((stats.totalPlaytime / games.length) * minuteMs);
	stats.totalSessions = games.length;
	stats.totalPlaytimeHuman = prettyDuration(stats.totalPlaytime * minuteMs);
	stats.favouriteGame = Object.entries(stats.games).reduce(
		(acc, cur) => {
			const [game, duration] = cur;
			if (duration >= acc.duration) {
				acc.duration = duration;
				acc.game = game;
			}
			return acc;
		},
		{ game: '', duration: 0 },
	).game;

	return stats;
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
	const statement = getStatement<{ id: number; name: string; count: number }>(
		'getPopularGames',
		`SELECT g.id, g.name, ceil(sum(s.playtime_mins) / 60.0) as count
		FROM game_session AS s
		JOIN games AS g ON g.id = s.game_id
		WHERE created_at >= $created_at
		GROUP BY name
		ORDER BY count DESC, name ASC
		LIMIT $limit`,
	);

	const created_at = new Date(Date.now() - days * dayMs).toISOString();
	const rows = statement.all({ created_at, limit });

	return rows.map(row => ({
		...row,
		popularityPercentage: (row.count / rows[0].count) * 100,
	}));
}
