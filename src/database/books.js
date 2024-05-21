import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import timeago from '../adapters/timeago.js';
import { calculateGetParameters } from './constants.js';
import { prettyDate } from '../lib/formatDate.js';

/**
 * @typedef {object} Book
 * @property {string} [id]
 * @property {string} title
 * @property {string} author
 * @property {string} [genre]
 * @property {number} year
 * @property {number} [pages_total]
 * @property {number} [pages_progress]
 * @property {number} [rating]
 * @property {string} [url]
 * @property {string} created_at
 * @property {string} started_at
 * @property {string} [completed_at]
 * @property {string} device_id
*/

/**
 * @export
 * @param {Book} book
 * @returns {import('better-sqlite3').RunResult}
 */
export function insertBook (book) {
	const id = uuid();

	const statement = getStatement(
		'insertBook',
		`INSERT INTO books
		(id, title, author, genre, year, pages_total, pages_progress, rating, url, started_at, completed_at, created_at, updated_at, device_id)
		VALUES
		($id, $title, $author, $genre, $year, $pages_total, $pages_progress, $rating, $url, $started_at, $completed_at, $created_at, $updated_at, $device_id)`,
	);

	return statement.run({
		id,
		...book,
	});
}

/**
 * Fetch all books, or based on a specific ID
 *
 * @export
 * @param {object} parameters
 * @param {string} [parameters.id]
 * @param {number} [parameters.page]
 * @param {number} [parameters.limit]
 * @param {number} [parameters.days]
 */
export function getBooks (parameters) {
	const statement = getStatement(
		'getBooks',
		`SELECT * FROM books
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY updated_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement
		.all(calculateGetParameters(parameters))
		.map(row => {
			let progress = null;
			let status = 'to-read';

			if (row.pages_total !== null) {
				const finished = row.pages_total === row.pages_progress;
				const percent = Math.round((row.pages_progress / row.pages_total) * 100);

				progress = `read ${percent}% <small>(${row.pages_progress || 0} / ${row.pages_total} pages)</small>`;
				status = 'reading';

				if (finished) {
					progress = `completed on ${prettyDate(new Date(row.completed_at))}`;
					status = 'finished';
				}
			}

			return {
				...row,
				progress,
				status,
				timeago: timeago.format(new Date(row.updated_at || row.created_at)),
			};
		});
}

/**
 * @export
 * @param {string} id
 * @returns {import('better-sqlite3').RunResult}
 */
export function deleteBook (id) {
	const statement = getStatement(
		'deleteBook',
		'DELETE FROM books WHERE id = $id',
	);

	return statement.run({ id });
}

/**
 * @export
 * @param {string} id
 * @param {Book} book
 * @returns {import('better-sqlite3').RunResult}
 */
export function updateBook (id, book) {
	const statement = getStatement(
		'updateBook',
		`UPDATE books
		SET title = $title,
		    author = $author,
		    genre = $genre,
		    year = $year,
		    pages_total = $pages_total,
		    pages_progress = $pages_progress,
		    rating = $rating,
		    url = $url,
		    created_at = $created_at,
		    updated_at = $updated_at,
		    started_at = $started_at,
		    completed_at = $completed_at
		WHERE id = $id`,
	);

	return statement.run({
		id,
		...book,
	});
}

/**
 * @return {number} Number of books recorded in database
 */
export function countBooks () {
	const statement = getStatement(
		'countBooks',
		'SELECT COUNT(*) as total FROM books',
	);

	return statement.get().total;
}
