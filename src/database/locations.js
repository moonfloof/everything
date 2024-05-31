import { v4 as uuid } from 'uuid';
import { dayMs } from '../lib/formatDate.js';
import { getStatement } from './database.js';

/**
 * @param {number} lat
 * @param {number} long
 * @param {string} city
 * @param {string} created_at
 * @param {string} device_id
 * @return {import('better-sqlite3').RunResult}
 */
export function insertLocation(lat, long, city, created_at, device_id) {
	const id = uuid();

	const statement = getStatement(
		'insertLocation',
		`INSERT INTO location
		(id, lat, long, city, created_at, device_id)
		VALUES
		($id, $lat, $long, $city, $created_at, $device_id)`,
	);

	return statement.run({
		id,
		lat,
		long,
		city,
		created_at: new Date(created_at || Date.now()).toISOString(),
		device_id,
	});
}

/** @return {string|undefined} */
export function getLatestCity() {
	const statement = getStatement(
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

/**
 * @param {Date} date_start
 * @param {Date} date_end
 * @returns {{lat: number, long: number, city: string|null}[]}
 */
export function getLocationHistory(date_start, date_end) {
	const statement = getStatement(
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
