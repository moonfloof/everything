import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import timeago from '../adapters/timeago.js';
import { calculateOffset, RECORDS_PER_PAGE } from './constants.js';

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

export function deleteYouTubeLike (id) {
	const statement = getStatement(
		'deleteYouTubeLike',
		'DELETE FROM youtubelikes WHERE id = $id',
	);

	return statement.run({ id });
}

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
