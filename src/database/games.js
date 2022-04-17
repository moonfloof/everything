import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import timeago from '../adapters/timeago.js';
import { dayMs, getStartOfDay, minuteMs, prettyDuration, shortDate } from '../lib/formatDate.js';
import { calculateOffset, RECORDS_PER_PAGE } from './constants.js';

export function insertNewGameActivity (name, device_id, playtime_mins = 0, created_at) {
	const id = uuid();
	const updated_at = new Date().toISOString();

	const statement = getStatement(
		'insertGameActivity',
		`INSERT INTO games
		(id, name, playtime_mins, created_at, updated_at, device_id)
		VALUES
		($id, $name, $playtime_mins, $created_at, $updated_at, $device_id)`,
	);

	return statement.run({
		id,
		name,
		playtime_mins,
		created_at: created_at || new Date(Date.now() - (playtime_mins * minuteMs)).toISOString(),
		updated_at,
		device_id,
	});
}

export function updateActivity (name, playtime_mins, device_id, intervalDuration) {
	const selectStatement = getStatement(
		'getGameActivityByName',
		`SELECT * FROM games WHERE name = $name
		ORDER BY created_at DESC LIMIT 1;`,
	);

	const row = selectStatement.get({ name });

	if (row === undefined) {
		insertNewGameActivity(name, device_id, playtime_mins);
		return;
	}

	const lastUpdated = new Date(row.updated_at).getTime();
	const lastCheck = Date.now() - intervalDuration - (playtime_mins * minuteMs) - minuteMs;

	if (lastUpdated < lastCheck) {
		insertNewGameActivity(name, device_id, playtime_mins);
		return;
	}

	const updateStatement = getStatement(
		'updateGameActivity',
		`UPDATE games
		SET playtime_mins = $playtime_mins,
		    updated_at = $updated_at
		WHERE id = $id`,
	);

	updateStatement.run({
		id: row.id,
		playtime_mins: row.playtime_mins + playtime_mins,
		updated_at: new Date().toISOString(),
	});
}

/**
 * Fetch all game activity, or based on a specific ID
 *
 * @export
 * @param {string} [id]
 * @param {number} [page]
 */
export function getGameActivity (id, page) {
	const statement = getStatement(
		'getGameActivity',
		`SELECT * FROM games
		WHERE id LIKE $id
		ORDER BY updated_at DESC
		LIMIT ${RECORDS_PER_PAGE} OFFSET $offset`,
	);

	return statement
		.all({
			id: id || '%',
			offset: calculateOffset(page),
		})
		.map(row => ({
			...row,
			duration: prettyDuration(row.playtime_mins * minuteMs),
			durationNumber: row.playtime_mins / 60,
			timeago: timeago.format(new Date(row.created_at)),
		}));
}

/**
 * Fetch all game activity, or based on a specific ID
 *
 * @export
 * @param {string} [id]
 * @param {number} [page]
 */
export function getGameActivityByDay (days = 7) {
	const created_at = new Date(Date.now() - (days * dayMs)).toISOString();

	const statement = getStatement(
		'getGameActivityByDay',
		`SELECT * FROM games
		WHERE created_at >= $created_at
		ORDER BY updated_at DESC`,
	);

	return statement
		.all({ created_at })
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
		LIMIT ${RECORDS_PER_PAGE}`,
	);

	return statement
		.all()
		.map(row => ({
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
			? 1
			: newAcc.games[cur.name] + 1;

		newAcc.totalPlaytime += cur.playtime_mins;

		return newAcc;
	}, emptyStats);

	stats.averagePlaytime = prettyDuration((stats.totalPlaytime / games.length) * 60000);
	stats.totalSessions = games.length;
	stats.totalPlaytimeHuman = prettyDuration(stats.totalPlaytime * 60000);
	stats.favouriteGame = Object
		.entries(stats.games)
		.reduce((acc, cur) => {
			const [ game, count ] = cur;
			const newAcc = { ...acc };
			if (count >= acc.count) {
				newAcc.count = count;
				newAcc.game = game;
			}
			return newAcc;
		}, { game: '', count: 0 })
		.game;
	return stats;
}

export function countGameActivity () {
	const statement = getStatement(
		'countGameActivity',
		'SELECT COUNT(*) as total FROM games',
	);

	return statement.get().total;
}

export function deleteGameActivity (id) {
	const statement = getStatement(
		'deleteGameActivity',
		'DELETE FROM games WHERE id = $id',
	);

	return statement.run({ id });
}

export function updateGameActivity (id, name, playtime_mins, created_at, updated_at) {
	const statement = getStatement(
		'updateGameActivity',
		`UPDATE games
		SET name = $name,
		    playtime_mins = $playtime_mins,
		    created_at = $created_at,
		    updated_at = $updated_at
		WHERE id = $id`,
	);

	return statement.run({
		id,
		name,
		playtime_mins: Number(playtime_mins),
		created_at,
		updated_at,
	});
}
