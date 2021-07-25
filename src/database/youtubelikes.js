import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import timeago from '../adapters/timeago.js';
import { calculateOffset, RECORDS_PER_PAGE } from './constants.js';

export function insertYouTubeLike (url, title, channel, device_id) {
	const id = uuid();
	const created_at = new Date().toISOString();

	const statement = getStatement(
		'insertYouTubeLike',
		`INSERT INTO youtubelikes
		(id, url, title, channel, device_id, created_at)
		VALUES
		($id, $url, $title, $channel, $device_id, $created_at)`,
	);

	return statement.run({
		id,
		url,
		title,
		channel,
		device_id,
		created_at,
	});
}

/**
 * Fetch all YouTube likes, or based on a specific ID
 *
 * @export
 * @param {string} [id]
 * @param {number} [page]
 */
export function getLikes (id, page) {
	const statement = getStatement(
		'getYouTubeLikes',
		`SELECT * FROM youtubelikes
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

export function countYouTubeLikes () {
	const statement = getStatement(
		'countYouTubeLikes',
		'SELECT COUNT(*) as total FROM youtubelikes',
	);

	return statement.get().total;
}
