import { getStatement } from './database.js';

export function validateDevice(api_key) {
	const statement = getStatement('validateDevice', 'SELECT * FROM devices WHERE api_key = $api_key LIMIT 1');

	const device = statement.get({ api_key });

	if (device === undefined) {
		throw new Error('Device not found');
	}

	return device;
}

export function getDevices() {
	const statement = getStatement(
		'getDevices',
		`SELECT id, description, battery_level, battery_status
		FROM devices
		ORDER BY updated_at DESC`,
	);

	return statement.all();
}

/**
 * @param {string} id
 * @param {number} battery_level
 * @param {string} battery_status
 * @return {import('better-sqlite3').RunResult}
 */
export function updateDevice(id, battery_level, battery_status) {
	const statement = getStatement(
		'updateDevice',
		`UPDATE devices
		SET battery_status = $battery_status,
		    battery_level = $battery_level,
		    updated_at = $updated_at
		WHERE id = $id`,
	);

	return statement.run({
		id,
		battery_level,
		battery_status,
		updated_at: new Date().toISOString(),
	});
}
