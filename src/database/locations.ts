import { config } from '../lib/config.js';
import { dayMs, minuteMs } from '../lib/formatDate.js';
import type { Insert } from '../types/database.js';
import { getStatement } from './database.js';

interface Location {
	lat: number;
	long: number;
	city?: string | null;
	created_at: number;
	device_id: string;
}

export function insertLocation(location: Insert<Location>) {
	const statement = getStatement(
		'insertLocation',
		`INSERT INTO location
		(lat, long, city, created_at, device_id)
		VALUES
		($lat, $long, $city, $created_at, $device_id)`,
	);

	return statement.run(location);
}

export function getLatestCity() {
	const statement = getStatement<{ city: string }>(
		'getLatestCity',
		`SELECT city FROM location
		WHERE city IS NOT NULL AND
		      created_at >= $created_at_min AND
		      created_at <= $created_at_max
		ORDER BY created_at DESC
		LIMIT 1`,
	);

	// Only return city if the data comes from within two days of the
	// allowed time period
	const locationDelayMs = config.location.delayMins * minuteMs;
	const created_at_min = Date.now() - 2 * dayMs - locationDelayMs;
	const created_at_max = Date.now() - locationDelayMs;

	return statement.get({ created_at_min, created_at_max })?.city;
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
		date_start: date_start.getTime(),
		date_end: date_end.getTime() + dayMs,
	});
}
