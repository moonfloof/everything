import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import timeago from '../adapters/timeago.js';
import { calculateGetParameters } from './constants.js';

/**
 * @param {string} url
 * @param {string} title
 * @param {string} channel
 * @param {string} device_id
 * @param {string} created_at
 * @return {import('better-sqlite3').RunResult}
 */
export function insertYouTubeLike (url, title, channel, device_id, created_at) {
	const statement = getStatement(
		'insertYouTubeLike',
		`INSERT INTO youtubelikes
		(id, url, title, channel, device_id, created_at)
		VALUES
		($id, $url, $title, $channel, $device_id, $created_at)`,
	);

	return statement.run({
		id: uuid(),
		url,
		title,
		channel,
		device_id,
		created_at: created_at || new Date().toISOString(),
	});
}

/**
 * Fetch all YouTube likes, or based on a specific ID
 *
 * @export
 * @param {object} parameters
 * @param {string} [parameters.id]
 * @param {number} [parameters.page]
 * @param {number} [parameters.limit]
 * @param {number} [parameters.days]
 */
export function getLikes (parameters) {
	const statement = getStatement(
		'getYouTubeLikes',
		`SELECT * FROM youtubelikes
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY created_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement
		.all(calculateGetParameters(parameters))
		.map(row => ({
			...row,
			timeago: timeago.format(new Date(row.created_at)),
		}));
}

/** @return {number} */
export function countYouTubeLikes () {
	const statement = getStatement(
		'countYouTubeLikes',
		'SELECT COUNT(*) as total FROM youtubelikes',
	);

	return statement.get().total;
}

/**
 * @param {string} id
 * @return {import('better-sqlite3').RunResult}
 */
export function deleteYouTubeLike (id) {
	const statement = getStatement(
		'deleteYouTubeLike',
		'DELETE FROM youtubelikes WHERE id = $id',
	);

	return statement.run({ id });
}

/**
 * @param {string} id
 * @param {string} url
 * @param {string} title
 * @param {string} channel
 * @param {string} created_at
 * @return {import('better-sqlite3').RunResult}
 */
export function updateYouTubeLike (id, url, title, channel, created_at) {
	const statement = getStatement(
		'updateYouTubeLike',
		`UPDATE youtubelikes
		SET url = $url,
		    title = $title,
		    channel = $channel,
		    created_at = $created_at
		WHERE id = $id`,
	);

	return statement.run({
		id,
		url,
		title,
		channel,
		created_at,
	});
}
