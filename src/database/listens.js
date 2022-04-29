import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import timeago from '../adapters/timeago.js';
import { calculateOffset, RECORDS_PER_PAGE } from './constants.js';
import { dayMs, shortDate } from '../lib/formatDate.js';

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
 * @return {Promise<any>}
 */
export function insertScrobble (artist, album, title, tracknumber, year, genre, created_at, device_id) {
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
		created_at,
		device_id,
	});
}

/**
 * Fetch all listens, or based on a specific ID
 *
 * @export
 * @param {string} [id]
 * @param {number} [page]
 */
export function getListens (id, page) {
	const statement = getStatement(
		'getListens',
		`SELECT * FROM listens
		WHERE id LIKE $id
		ORDER BY created_at DESC
		LIMIT ${RECORDS_PER_PAGE} OFFSET $offset`,
	);

	return statement
		.all({
			id: id || '%',
			offset: calculateOffset(page),
		})
		.map(row => ({
			...row,
			timeago: timeago.format(new Date(row.created_at)),
		}));
}

export function deleteListen (id) {
	const statement = getStatement(
		'deleteListen',
		'DELETE FROM listens WHERE id = $id',
	);
	return statement.run({ id });
}

export function updateListen (id, artist, album, title, tracknumber, release_year, genre, created_at) {
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
		created_at,
	});
}

export function countListens () {
	const statement = getStatement(
		'countListens',
		'SELECT COUNT(*) as total FROM listens',
	);

	return statement.get().total;
}

export function getListensPopular (days) {
	const statement = getStatement(
		'getListensPopular',
		`SELECT artist, count(*) as count
		FROM listens
		WHERE created_at >= $created_at
		GROUP BY artist
		ORDER BY count DESC, artist ASC;`,
	);

	const created_at = new Date(Date.now() - (days * dayMs)).toISOString();

	return statement.all({ created_at });
}

export function getListenPopularDashboard (days) {
	const genStatement = table => getStatement(
		`getListenPopularDashboard_${table}`,
		`SELECT ${table}, count(*) as count
		FROM listens
		WHERE created_at >= $created_at
		GROUP BY ${table}
		ORDER BY count DESC
		LIMIT 1;`,
	);

	const created_at = new Date(Date.now() - (days * dayMs)).toISOString();

	const artist = genStatement('artist').all({ created_at })?.[0];
	const album = genStatement('album').all({ created_at })?.[0];
	const song = genStatement('title').all({ created_at })?.[0];

	return {
		artist,
		album,
		song,
	};
}

export function getListenGraph () {
	const statement = getStatement(
		'getListenGraph',
		`SELECT DATE(created_at) as day, COUNT(*) as y
		FROM listens
		GROUP BY day
		ORDER BY day DESC
		LIMIT 14;`,
	);

	return statement
		.all()
		.map(row => ({
			...row,
			label: shortDate(new Date(row.day)),
		}));
}

export function getListenDashboardGraph () {
	const statement = getStatement(
		'getListenDashboardGraph',
		`SELECT DATE(created_at) as day, COUNT(*) as max
		FROM listens
		GROUP BY day
		ORDER BY day DESC
		LIMIT 14;`,
	);

	return statement
		.all()
		.map(row => ({
			...row,
			min: 0,
			max: row.max,
		}));
}
