import { v4 as uuid } from 'uuid';
import { getDatabase } from './getDatabase.js';

export async function insertLocation (lat, long, city, timestamp, deviceId) {
	const db = await getDatabase();

	const id = uuid();

	const statement = await db.prepare(`
		INSERT INTO location
		(id, lat, long, city, created_at, device_id)
		VALUES
		($id, $lat, $long, $city, $createdAt, $deviceId)
	`);

	await statement.bind({
		$id: id,
		$lat: lat,
		$long: long,
		$city: city,
		$createdAt: timestamp,
		$deviceId: deviceId,
	});

	return statement.run();
}
