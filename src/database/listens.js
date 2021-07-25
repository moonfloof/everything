import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import timeago from '../adapters/timeago.js';
import { RECORDS_PER_PAGE } from './constants.js';

/**
 * @export
 * @param {string} artist
 * @param {string} album
 * @param {string} title
 * @param {number} [tracknumber]
 * @param {number} [year]
 * @param {string} [genre]
 * @param {Date}   createdAt
 * @param {string} deviceId
 * @return {Promise<any>}
 */
export function insertScrobble (artist, album, title, tracknumber, year, genre, createdAt, deviceId) {
	const id = uuid();

	const statement = getStatement(
		'insertListen',
		`INSERT INTO listens
		(id, artist, album, title, tracknumber, release_year, genre, created_at, device_id)
		VALUES
		($id, $artist, $album, $title, $tracknumber, $year, $genre, $createdAt, $deviceId)`,
	);

	return statement.run({
		id,
		artist,
		album,
		title,
		tracknumber,
		year,
		genre,
		createdAt,
		deviceId,
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
	const statement = getStatement('getListens', `
		SELECT * FROM listens
		WHERE id LIKE $id
		ORDER BY created_at DESC
		LIMIT ${RECORDS_PER_PAGE} OFFSET $offset
	`);

	return statement
		.all({
			id: id || '%',
			offset: page ? (page - 1) * RECORDS_PER_PAGE : 0,
		})
		.map(row => ({
			...row,
			timeago: timeago.format(new Date(row.created_at)),
		}));
}

export function getPopular (days) {
	const statement = getStatement(
		'getPopularListens',
		`SELECT artist, count(*) as count
		FROM listens
		WHERE created_at >= $createdAt
		GROUP BY artist
		ORDER BY count DESC, artist ASC;`,
	);

	const createdAt = new Date(Date.now() - (days * 86400000)).toISOString();

	return statement.all({ createdAt });
}

export function deleteListen (id) {
	const statement = getStatement('deleteListen', 'DELETE FROM listens WHERE id = $id');
	return statement.run({ id });
}
