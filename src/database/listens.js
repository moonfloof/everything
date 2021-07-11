import { v4 as uuid } from 'uuid';
import { getDatabase } from './getDatabase.js';

/**
 * @export
 * @param {string} artist
 * @param {string} album
 * @param {string} title
 * @param {number} [tracknumber]
 * @param {number} [year]
 * @param {string} [genre]
 * @param {Date}   timestamp
 * @param {string} deviceId
 * @return {Promise<any>}
 */
export async function insertScrobble (artist, album, title, tracknumber, year, genre, timestamp, deviceId) {
	const db = await getDatabase();

	const id = uuid();

	const statement = await db.prepare(`
		INSERT INTO listens
		(id, artist, album, title, tracknumber, release_year, genre, created_at, device_id)
		VALUES
		($id, $artist, $album, $title, $tracknumber, $year, $genre, $createdAt, $deviceId)
	`);

	await statement.bind({
		$id: id,
		$artist: artist,
		$album: album,
		$title: title,
		$tracknumber: tracknumber,
		$year: year,
		$genre: genre,
		$createdAt: timestamp,
		$deviceId: deviceId,
	});

	return statement.run();
}

/**
 * Fetch all listens, or based on a specific ID
 *
 * @export
 * @param {string} [id]
 * @param {number} [page]
 */
export async function getListens (id, page) {
	const db = await getDatabase();

	const statement = await db.prepare(`
		SELECT * FROM listens
		WHERE id LIKE $id
		ORDER BY created_at DESC
		LIMIT 50 OFFSET $offset
	`);

	await statement.bind({
		$id: id || '%',
		$offset: page ? (page - 1) * 50 : 0,
	});

	return statement.all();
}
