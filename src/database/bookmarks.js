import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import { calculateGetParameters } from './constants.js';

export function insertBookmark (title, url, device_id, created_at) {
	const statement = getStatement(
		'insertBookmark',
		`INSERT INTO bookmarks
		(id, title, url, created_at, device_id)
		VALUES
		($id, $title, $url, $created_at, $device_id)`,
	);

	return statement.run({
		id: uuid(),
		title,
		url,
		device_id,
		created_at: created_at ?? new Date().toISOString(),
	});
}


/**
 * Fetch all bookmarks, or based on a specific ID
 *
 * @export
 * @param {object} parameters
 * @param {string} [parameters.id]
 * @param {number} [parameters.page]
 * @param {number} [parameters.limit]
 * @param {number} [parameters.days]
 */
export function getBookmarks (parameters) {
	const statement = getStatement(
		'getBookmarks',
		`SELECT * FROM bookmarks
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY created_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters));
}

export function countBookmarks () {
	const statement = getStatement(
		'countBookmarks',
		'SELECT COUNT(*) as total FROM bookmarks',
	);

	return statement.get().total;
}

export function deleteBookmark (id) {
	const statement = getStatement(
		'deleteBookmark',
		'DELETE FROM bookmarks WHERE id = $id',
	);

	return statement.run({ id });
}

export function updateBookmark (id, title, url, created_at) {
	const statement = getStatement(
		'updateBookmark',
		`UPDATE bookmarks
		SET title = $title,
		    url = $url,
		    created_at = $created_at
		WHERE id = $id`,
	);

	return statement.run({ id, title, url, created_at });
}
