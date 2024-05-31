import { v4 as uuid } from 'uuid';
import timeago from '../adapters/timeago.js';
import { dayMs, shortDate } from '../lib/formatDate.js';
import { calculateGetParameters } from './constants.js';
import { getStatement } from './database.js';

/**
 * @typedef {object} Listen
 * @prop {string} id             Primary key stored as UUID
 * @prop {string} artist
 * @prop {string} album
 * @prop {string} title
 * @prop {number} [tracknumber]  Usually not provided by scrobblers
 * @prop {number} [release_year] See above
 * @prop {string} [genre]        See above
 * @prop {string} created_at     ISO timestamp
 * @prop {string} timeago        Relative timestamp (eg. "3 hours ago")
 */

/**
 * @export
 * @param {string} artist
 * @param {string} album
 * @param {string} title
 * @param {number} [tracknumber]
 * @param {number} [year]
 * @param {string} [genre]
 * @param {Date}   created_at
 * @param {string} device_id
 * @returns {import('better-sqlite3').RunResult}
 */
export function insertScrobble(artist, album, title, tracknumber, year, genre, created_at, device_id) {
	const id = uuid();

	const statement = getStatement(
		'insertListen',
		`INSERT INTO listens
		(id, artist, album, title, tracknumber, release_year, genre, created_at, device_id)
		VALUES
		($id, $artist, $album, $title, $tracknumber, $year, $genre, $created_at, $device_id)`,
	);

	return statement.run({
		id,
		artist,
		album,
		title,
		tracknumber,
		year,
		genre,
		created_at: new Date(created_at || Date.now()).toISOString(),
		device_id,
	});
}

/**
 * Fetch all listens, or based on a specific ID
 *
 * @export
 * @param {object} parameters
 * @param {string} [parameters.id]
 * @param {number} [parameters.page]
 * @param {number} [parameters.limit]
 * @param {number} [parameters.days]
 */
export function getListens(parameters) {
	const statement = getStatement(
		'getListens',
		`SELECT * FROM listens
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY created_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters)).map(row => ({
		...row,
		timeago: timeago.format(new Date(row.created_at)),
	}));
}

/**
 * @param {Listen[]} listens
 */
export function groupListens(listens) {
	return listens.reduce((albums, listen) => {
		if (
			albums.length === 0 ||
			albums[albums.length - 1].album !== listen.album ||
			albums[albums.length - 1].artist !== listen.artist
		) {
			albums.push({
				artist: listen.artist,
				album: listen.album,
				created_at: listen.created_at,
				ended_at: listen.created_at,
				timeago: listen.timeago,
				tracks: [{ title: listen.title, id: listen.id }],
				count: 1,
				countText: 'song',
			});
			return albums;
		}

		albums[albums.length - 1].tracks.push({ title: listen.title, id: listen.id });
		albums[albums.length - 1].count += 1;
		albums[albums.length - 1].countText = 'songs';
		albums[albums.length - 1].created_at = listen.created_at;
		return albums;
	}, []);
}

/**
 * @param {string} id
 * @return {import('better-sqlite3').RunResult}
 */
export function deleteListen(id) {
	const statement = getStatement('deleteListen', 'DELETE FROM listens WHERE id = $id');
	return statement.run({ id });
}

/**
 * @param {string} id
 * @param {string} artist
 * @param {string} album
 * @param {string} title
 * @param {number} tracknumber
 * @param {number} release_year
 * @param {string} genre
 * @param {string} created_at
 * @return {import('better-sqlite3').RunResult}
 */
export function updateListen(id, artist, album, title, tracknumber, release_year, genre, created_at) {
	const statement = getStatement(
		'updateListen',
		`UPDATE listens
		SET artist = $artist,
		    album = $album,
		    title = $title,
		    tracknumber = $tracknumber,
		    release_year = $release_year,
		    genre = $genre,
		    created_at = $created_at
		WHERE id = $id`,
	);

	return statement.run({
		id,
		artist,
		album,
		title,
		tracknumber,
		release_year,
		genre,
		created_at: new Date(created_at || Date.now()).toISOString(),
	});
}

/** @returns {number} */
export function countListens() {
	const statement = getStatement('countListens', 'SELECT COUNT(*) as total FROM listens');

	return statement.get().total;
}

/**
 * @param {number} days
 * @return {{ artist: string, count: number, popularityPercentage: number }[]}
 */
export function getListensPopular(days) {
	const statement = getStatement(
		'getListensPopular',
		`SELECT artist, count(*) as count
		FROM listens
		WHERE created_at >= $created_at
		GROUP BY artist
		ORDER BY count DESC, artist ASC
		LIMIT 30`,
	);

	const created_at = new Date(Date.now() - days * dayMs).toISOString();

	const rows = statement.all({ created_at });

	return rows.map(row => ({
		...row,
		popularityPercentage: (row.count / rows[0].count) * 100,
	}));
}

/**
 * @param {number} days
 * @return {{ artist?: string, album?: string, song?: string }}
 */
export function getListenPopularDashboard(days) {
	const generateStatement = column =>
		getStatement(
			`getListenPopularDashboard_${column}`,
			`SELECT ${column}, count(*) as count
			FROM listens
			WHERE created_at >= $created_at
			GROUP BY ${column}
			ORDER BY count DESC
			LIMIT 1;`,
		);

	const created_at = new Date(Date.now() - days * dayMs).toISOString();

	const artist = generateStatement('artist').all({ created_at })?.[0];
	const album = generateStatement('album').all({ created_at })?.[0];
	const song = generateStatement('title').all({ created_at })?.[0];

	return {
		artist,
		album,
		song,
	};
}

/**
 * @return {{ day: string, y: number, label: string }[]}
 */
export function getListenGraph() {
	const statement = getStatement(
		'getListenGraph',
		`SELECT DATE(created_at) as day, COUNT(*) as y
		FROM listens
		GROUP BY day
		ORDER BY day DESC
		LIMIT 14;`,
	);

	return statement.all().map(row => ({
		...row,
		label: shortDate(new Date(row.day)),
	}));
}

export function getListenDashboardGraph() {
	const statement = getStatement(
		'getListenDashboardGraph',
		`SELECT DATE(created_at) as day, COUNT(*) as max
		FROM listens
		GROUP BY day
		ORDER BY day DESC
		LIMIT 14;`,
	);

	return statement.all().map(row => ({
		...row,
		min: 0,
		max: row.max,
	}));
}
