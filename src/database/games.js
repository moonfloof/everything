import { v4 as uuid } from 'uuid';
import timeago from '../adapters/timeago.js';
import { dayMs, getStartOfDay, isoDuration, minuteMs, prettyDuration, shortDate } from '../lib/formatDate.js';
import { getStatement } from './database.js';
import { calculateGetParameters } from './constants.js';
import { getGameAchievementsForSession } from './gameachievements.js';

/**
 * @param {string} name
 * @param {string} device_id
 * @param {number} [playtime_mins=0]
 * @param {string} url
 * @param {string} created_at
 * @return {import('better-sqlite3').RunResult}
 */
export function insertNewGameActivity (name, device_id, playtime_mins = 0, url, created_at) {
	const id = uuid();
	const updated_at = new Date().toISOString();

	const statement = getStatement(
		'insertGameActivity',
		`INSERT INTO games
		(id, name, playtime_mins, url, created_at, updated_at, device_id)
		VALUES
		($id, $name, $playtime_mins, $url, $created_at, $updated_at, $device_id)`,
	);

	const result = statement.run({
		id,
		name,
		playtime_mins,
		url,
		created_at: created_at || new Date(Date.now() - (playtime_mins * minuteMs)).toISOString(),
		updated_at,
		device_id,
	});

	return {
		...result,
		id,
	};
}

/**
 * @param {string} name
 * @param {number} playtime_mins
 * @param {string} url
 * @param {string} device_id
 * @param {number} intervalDuration
 * @return {import('better-sqlite3').RunResult}
 */
export function updateActivity (name, playtime_mins, url, device_id, intervalDuration) {
	const selectStatement = getStatement(
		'getGameActivityByName',
		`SELECT * FROM games WHERE name = $name
		ORDER BY created_at DESC LIMIT 1;`,
	);

	const row = selectStatement.get({ name });

	if (row === undefined) {
		return insertNewGameActivity(name, device_id, playtime_mins, url);
	}

	const lastUpdated = new Date(row.updated_at).getTime();
	const lastCheck = Date.now() - intervalDuration - (playtime_mins * minuteMs) - minuteMs;

	if (lastUpdated < lastCheck) {
		return insertNewGameActivity(name, device_id, playtime_mins, url);
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
		playtime_mins: row.playtime_mins + playtime_mins,
		updated_at: new Date().toISOString(),
	});

	return {
		id: row.id,
		...result,
	};
}

/**
 * Fetch all game activity, or based on a specific ID
 *
 * @export
 * @param {object} parameters
 * @param {string} [parameters.id]
 * @param {number} [parameters.page]
 * @param {number} [parameters.limit]
 * @param {number} [parameters.days]
 */
export function getGameActivity (parameters) {
	const statement = getStatement(
		'getGameActivity',
		`SELECT * FROM games
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY updated_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement
		.all(calculateGetParameters(parameters))
		.map(row => {
			const achievements = getGameAchievementsForSession(row.id);
			const achievementText = achievements.length === 1
				? 'achievement'
				: 'achievements';

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

/**
 * Fetch all game activity, or based on a specific ID
 *
 * @export
 * @param {string} [id]
 * @param {number} [page]
 */
export function getGameActivityByDay (days = 7) {
	const statement = getStatement(
		'getGameActivityByDay',
		`SELECT * FROM games
		WHERE created_at >= $created_at
		ORDER BY updated_at DESC`,
	);

	return statement
		.all({
			created_at: new Date(Date.now() - (days * dayMs)).toISOString(),
		})
		.map(row => ({
			...row,
			duration: prettyDuration(row.playtime_mins * minuteMs),
			durationNumber: row.playtime_mins / 60,
			timeago: timeago.format(new Date(row.created_at)),
		}));
}

/**
 * Fetch total duration of games played from the last two weeks
 *
 * @export
 * @param {number} [days=14]
 * @return {object[]}
 */
export function getGameActivityGroupedByDay (days = 14) {
	const daysAgo = new Date(Date.now() - (days * dayMs));
	const created_at = getStartOfDay(daysAgo).toISOString();

	const statement = getStatement(
		'getGameActivityGroupedByDay',
		`SELECT
			DATE(created_at) as day,
			SUM(playtime_mins) as playtime_mins
		FROM games
		WHERE created_at >= $created_at
		GROUP BY day
		ORDER BY day DESC`,
	);

	return statement
		.all({ created_at })
		.map(row => ({
			...row,
			y: row.playtime_mins / 60,
			label: shortDate(new Date(row.day)),
		}));
}

export function getGameDashboardGraph () {
	const statement = getStatement(
		'getGameDashboardGraph',
		`SELECT
			DATE(created_at) as day,
			SUM(playtime_mins) as playtime_mins
		FROM games
		GROUP BY day
		ORDER BY day DESC
		LIMIT $limit`,
	);

	return statement
		.all()
		.map(row => ({
			...row,
			min: 0,
			max: row.playtime_mins,
		}));
}

export function getGameStats () {
	const emptyStats = {
		totalPlaytime: 0,
		games: {},
	};
	const games = getGameActivityByDay(7);

	if (games.length === 0) return emptyStats;

	const stats = games.reduce((acc, cur) => {
		let newAcc = { ...acc };

		newAcc.games[cur.name] = newAcc.games[cur.name] === undefined
			? cur.playtime_mins
			: newAcc.games[cur.name] + cur.playtime_mins;

		newAcc.totalPlaytime += cur.playtime_mins;

		return newAcc;
	}, emptyStats);

	stats.averagePlaytime = prettyDuration((stats.totalPlaytime / games.length) * 60000);
	stats.totalSessions = games.length;
	stats.totalPlaytimeHuman = prettyDuration(stats.totalPlaytime * 60000);
	stats.favouriteGame = Object
		.entries(stats.games)
		.reduce((acc, cur) => {
			const [ game, duration ] = cur;
			const newAcc = { ...acc };
			if (duration >= acc.duration) {
				newAcc.duration = duration;
				newAcc.game = game;
			}
			return newAcc;
		}, { game: '', duration: 0 })
		.game;
	return stats;
}

/** @return {number} */
export function countGameActivity () {
	const statement = getStatement(
		'countGameActivity',
		'SELECT COUNT(*) as total FROM games',
	);

	return statement.get().total;
}

/**
 * @param {string} id
 * @return {import('better-sqlite3').RunResult}
 */
export function deleteGameActivity (id) {
	const statement = getStatement(
		'deleteGameActivity',
		'DELETE FROM games WHERE id = $id',
	);

	return statement.run({ id });
}

/**
 * @param {string} id
 * @param {string} name
 * @param {number} playtime_mins
 * @param {string} url
 * @param {string} created_at
 * @param {string} updated_at
 * @return {import('better-sqlite3').RunResult}
 */
export function updateGameActivity (id, name, playtime_mins, url, created_at, updated_at) {
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
		id,
		name,
		playtime_mins: Number(playtime_mins),
		url,
		created_at,
		updated_at,
	});
}
