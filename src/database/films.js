import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import timeago from '../adapters/timeago.js';
import { calculateOffset, RECORDS_PER_PAGE } from './constants.js';

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
 * @return {Promise<any>}
 */
export function insertFilm (title, year, rating, review, url, watched_at, created_at, device_id) {
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
		watched_at,
		created_at,
		device_id,
	});
}

/**
 * Fetch all watched episodes, or based on a specific ID
 *
 * @export
 * @param {string} [id]
 * @param {number} [page]
 */
export function getFilms (id, page) {
	const statement = getStatement(
		'getFilms',
		`SELECT * FROM films
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
			timeago: timeago.format(new Date(row.watched_at)),
		}));
}

export function deleteFilm (id) {
	const statement = getStatement(
		'deleteFilm',
		'DELETE FROM films WHERE id = $id',
	);
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
 */
export function updateFilm (id, title, year, rating, review, url, watched_at, created_at) {
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
		watched_at,
		created_at,
	});
}

/**
 * @return {number} Number of films recorded in database
 */
export function countFilms () {
	const statement = getStatement(
		'countFilms',
		'SELECT COUNT(*) as total FROM films',
	);

	return statement.get().total;
}
