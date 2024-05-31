import { v4 as uuid } from 'uuid';
import timeago from '../adapters/timeago.js';
import { calculateGetParameters } from './constants.js';
import { getStatement } from './database.js';

/**
 * @export
 * @param {string} title
 * @param {string} year
 * @param {string} rating
 * @param {string} review
 * @param {string} url
 * @param {string} watched_at
 * @param {string} created_at
 * @param {string} device_id
 * @returns {import('better-sqlite3').RunResult}
 */
export function insertFilm(title, year, rating, review, url, watched_at, created_at, device_id) {
	const id = uuid();

	const statement = getStatement(
		'insertFilm',
		`INSERT INTO films
		(id, title, year, rating, review, url, watched_at, created_at, device_id)
		VALUES
		($id, $title, $year, $rating, $review, $url, $watched_at, $created_at, $device_id)`,
	);

	return statement.run({
		id,
		title,
		year,
		rating,
		review,
		url,
		watched_at: new Date(watched_at || Date.now()).toISOString(),
		created_at: new Date(created_at || Date.now()).toISOString(),
		device_id,
	});
}

/**
 * Fetch all watched episodes, or based on a specific ID
 *
 * @export
 * @param {object} parameters
 * @param {string} [parameters.id]
 * @param {number} [parameters.page]
 * @param {number} [parameters.limit]
 * @param {number} [parameters.days]
 */
export function getFilms(parameters) {
	const statement = getStatement(
		'getFilms',
		`SELECT * FROM films
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY created_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters)).map(row => ({
		...row,
		timeago: timeago.format(new Date(row.watched_at)),
	}));
}

/**
 * @param {string} id
 * @return {import('better-sqlite3').RunResult}
 */
export function deleteFilm(id) {
	const statement = getStatement('deleteFilm', 'DELETE FROM films WHERE id = $id');
	return statement.run({ id });
}

/**
 * @param {string} id
 * @param {string} title
 * @param {string} year
 * @param {string} rating
 * @param {string} review
 * @param {string} url
 * @param {string} watched_at
 * @param {string} created_at
 * @returns {import('better-sqlite3').RunResult}
 */
export function updateFilm(id, title, year, rating, review, url, watched_at, created_at) {
	const statement = getStatement(
		'updateFilm',
		`UPDATE films
		SET title = $title,
		    year = $year,
		    rating = $rating,
		    review = $review,
		    url = $url,
		    watched_at = $watched_at,
		    created_at = $created_at
		WHERE id = $id`,
	);

	return statement.run({
		id,
		title,
		year,
		rating,
		review,
		url,
		watched_at: new Date(watched_at || Date.now()).toISOString(),
		created_at: new Date(created_at || Date.now()).toISOString(),
	});
}

/** @return {number} Number of films recorded in database */
export function countFilms() {
	const statement = getStatement('countFilms', 'SELECT COUNT(*) as total FROM films');

	return statement.get().total;
}
