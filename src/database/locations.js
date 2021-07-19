import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';

export function insertLocation (lat, long, city, createdAt, deviceId) {
	const id = uuid();

	const statement = getStatement(
		'insertLocation',
		`INSERT INTO location
		(id, lat, long, city, created_at, device_id)
		VALUES
		($id, $lat, $long, $city, $createdAt, $deviceId)`,
	);

	return statement.run({
		id,
		lat,
		long,
		city,
		createdAt,
		deviceId,
	});
}
