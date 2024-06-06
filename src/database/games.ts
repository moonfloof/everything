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
import type { Optional } from '../types/database.js';
import { type Parameters, calculateGetParameters } from './constants.js';
import { getStatement } from './database.js';
import { getGameAchievementsForSession } from './gameachievements.js';

interface Game {
	id: string;
	name: string;
	playtime_mins: number;
	url: Optional<string>;
	created_at: string;
	updated_at: string;
	device_id: string;
}

interface GameStats {
	totalPlaytime: number;
	games: Record<string, number>;
	averagePlaytime: string;
	totalSessions: number;
	totalPlaytimeHuman: string;
	favouriteGame: string;
}

export function insertNewGameActivity(game: Omit<Game, 'id' | 'updated_at'>) {
	const id = uuid();
	const statement = getStatement(
		'insertGameActivity',
		`INSERT INTO games
		(id, name, playtime_mins, url, created_at, updated_at, device_id)
		VALUES
		($id, $name, $playtime_mins, $url, $created_at, $updated_at, $device_id)`,
	);

	const created_at = game.created_at
		? dateDefault(game.created_at)
		: new Date(Date.now() - game.playtime_mins * minuteMs).toISOString();

	const result = statement.run({
		...game,
		id: uuid(),
		created_at,
		updated_at: new Date().toISOString(),
	});

	return {
		...result,
		id,
	};
}

export function updateActivity(game: Omit<Game, 'id' | 'created_at' | 'updated_at'>, intervalDurationMs: number) {
	const selectStatement = getStatement<Game>(
		'getGameActivityByName',
		`SELECT * FROM games WHERE name = $name
		ORDER BY created_at DESC LIMIT 1;`,
	);

	const row = selectStatement.get({ name });

	if (row === undefined) {
		return insertNewGameActivity({ ...game, created_at: '' });
	}

	const lastUpdated = new Date(row.updated_at || Date.now()).getTime();
	const lastCheck = Date.now() - intervalDurationMs - game.playtime_mins * minuteMs - minuteMs;

	if (lastUpdated < lastCheck) {
		return insertNewGameActivity({ ...game, created_at: '' });
	}

	const updateStatement = getStatement(
		'updateGameActivityInternal',
		`UPDATE games
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
		id: row.id,
		...result,
	};
}

export function getGameActivity(parameters: Partial<Parameters> = {}) {
	const statement = getStatement<Game>(
		'getGameActivity',
		`SELECT * FROM games
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY updated_at DESC
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

export function getGameActivityByDay(days = 7) {
	const statement = getStatement<Game>(
		'getGameActivityByDay',
		`SELECT * FROM games
		WHERE created_at >= $created_at
		ORDER BY updated_at DESC`,
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

export function getGameActivityGroupedByDay(days = 14) {
	const daysAgo = new Date(Date.now() - days * dayMs);
	const created_at = getStartOfDay(daysAgo).toISOString();

	const statement = getStatement<{ day: string; playtime_mins: number }>(
		'getGameActivityGroupedByDay',
		`SELECT
			DATE(created_at) as day,
			SUM(playtime_mins) as playtime_mins
		FROM games
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

export function getGameDashboardGraph() {
	const statement = getStatement<{ day: string; playtime_mins: number }>(
		'getGameDashboardGraph',
		`SELECT
			DATE(created_at) as day,
			SUM(playtime_mins) as playtime_mins
		FROM games
		GROUP BY day
		ORDER BY day DESC
		LIMIT $limit`,
	);

	return statement.all().map(row => ({
		...row,
		min: 0,
		max: row.playtime_mins,
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
	const games = getGameActivityByDay(7);

	if (games.length === 0) return emptyStats;

	const stats = games.reduce((stats, cur) => {
		stats.games[cur.name] =
			stats.games[cur.name] === undefined
				? cur.playtime_mins
				: stats.games[cur.name] + cur.playtime_mins;

		stats.totalPlaytime += cur.playtime_mins;

		return stats;
	}, emptyStats);

	stats.averagePlaytime = prettyDuration((stats.totalPlaytime / games.length) * 60000);
	stats.totalSessions = games.length;
	stats.totalPlaytimeHuman = prettyDuration(stats.totalPlaytime * 60000);
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

export function countGameActivity() {
	const statement = getStatement<{ total: number }>('countGameActivity', 'SELECT COUNT(*) as total FROM games');
	return statement.get()?.total || 0;
}

export function deleteGameActivity(id: string) {
	const statement = getStatement('deleteGameActivity', 'DELETE FROM games WHERE id = $id');

	return statement.run({ id });
}

export function updateGameActivity(game: Omit<Game, 'device_id' | 'updated_at'>) {
	const statement = getStatement(
		'updateGameActivity',
		`UPDATE games
		SET name = $name,
		    playtime_mins = $playtime_mins,
		    url = $url,
		    created_at = $created_at,
		    updated_at = $updated_at
		WHERE id = $id`,
	);

	return statement.run({
		...game,
		playtime_mins: Number(game.playtime_mins),
		created_at: dateDefault(game.created_at),
		updated_at: new Date().toISOString(),
	});
}
