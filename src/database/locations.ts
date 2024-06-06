import { v4 as uuid } from 'uuid';
import { dateDefault, dayMs } from '../lib/formatDate.js';
import { getStatement } from './database.js';

interface Location {
	id: string;
	lat: number;
	long: number;
	city?: string | null;
	created_at: string;
	device_id: string;
}

export function insertLocation(location: Omit<Location, 'id'>) {
	const statement = getStatement(
		'insertLocation',
		`INSERT INTO location
		(id, lat, long, city, created_at, device_id)
		VALUES
		($id, $lat, $long, $city, $created_at, $device_id)`,
	);

	return statement.run({
		...location,
		id: uuid(),
		created_at: dateDefault(location.created_at),
	});
}

export function getLatestCity() {
	const statement = getStatement<{ city: string }>(
		'getLatestCity',
		`SELECT city FROM location
		WHERE city IS NOT NULL AND
		      created_at >= $created_at
		ORDER BY created_at DESC
		LIMIT 1`,
	);

	// Only return city if the data comes from the last two days
	const created_at = new Date(Date.now() - 2 * dayMs).toISOString();

	return statement.get({ created_at })?.city;
}

export function getLocationHistory(date_start: Date, date_end: Date) {
	const statement = getStatement<Pick<Location, 'lat' | 'long' | 'city'>>(
		'getLocationHistory',
		`SELECT lat, long, city FROM location
		WHERE created_at >= $date_start AND
		      created_at <= $date_end
		ORDER BY created_at ASC`,
	);

	return statement.all({
		date_start: date_start.toISOString(),
		date_end: new Date(date_end.getTime() + dayMs).toISOString(),
	});
}
