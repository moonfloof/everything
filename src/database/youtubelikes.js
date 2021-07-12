import { v4 as uuid } from 'uuid';
import { getDatabase } from './getDatabase.js';
import timeago from '../adapters/timeago.js';

export async function insertYouTubeLike (url, title, deviceId) {
	const db = await getDatabase();

	const id = uuid();

	const statement = await db.prepare(`
		INSERT INTO youtubelikes
		(id, url, title, device_id)
		VALUES
		($id, $url, $title, $deviceId)
	`);

	await statement.bind({
		$id: id,
		$url: url,
		$title: title,
		$deviceId: deviceId,
	});

	return statement.run();
}

/**
 * Fetch all YouTube likes, or based on a specific ID
 *
 * @export
 * @param {string} [id]
 * @param {number} [page]
 */
export async function getLikes (id, page) {
	const db = await getDatabase();

	const statement = await db.prepare(`
		SELECT * FROM youtubelikes
		WHERE id LIKE $id
		ORDER BY created_at DESC
		LIMIT 50 OFFSET $offset
	`);

	await statement.bind({
		$id: id || '%',
		$offset: page ? (page - 1) * 50 : 0,
	});

	return statement
		.all()
		.then(rows => rows.map(row => ({
			...row,
			timeago: timeago.format(new Date(row.created_at)),
		})));
}
