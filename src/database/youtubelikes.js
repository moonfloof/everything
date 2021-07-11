import { v4 as uuid } from 'uuid';
import { getDatabase } from './getDatabase.js';

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
