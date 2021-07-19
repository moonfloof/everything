import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import timeago from '../adapters/timeago.js';

export function insertYouTubeLike (url, title, channel, deviceId) {
	const id = uuid();
	const createdAt = new Date().toISOString();

	const statement = getStatement(
		'insertYouTubeLike',
		`INSERT INTO youtubelikes
		(id, url, title, channel, device_id, created_at)
		VALUES
		($id, $url, $title, $channel, $deviceId, $createdAt)`,
	);

	return statement.run({
		id,
		url,
		title,
		channel,
		deviceId,
		createdAt,
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
		LIMIT 50 OFFSET $offset`,
	);

	return statement
		.all({
			id: id || '%',
			offset: page ? (page - 1) * 50 : 0,
		})
		.map(row => ({
			...row,
			timeago: timeago.format(new Date(row.created_at)),
		}));
}
