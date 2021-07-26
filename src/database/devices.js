import { getStatement } from './database.js';

export function validateDevice (api_key) {
	const statement = getStatement(
		'validateDevice',
		'SELECT * FROM devices WHERE api_key = $api_key LIMIT 1',
	);

	const device = statement.get({ api_key });

	if (device === undefined) {
		throw new Error('Device not found');
	}

	return device;
}

export function getDevices () {
	const statement = getStatement(
		'getDevices',
		`SELECT id, description, battery_level, battery_status
		FROM devices`,
	);

	return statement.all();
}

export function updateDevice (id, battery_level, battery_status) {
	const statement = getStatement(
		'updateDevice',
		`UPDATE devices
		SET battery_status = $battery_status,
		    battery_level = $battery_level
		WHERE id = $id`,
	);

	return statement.run({
		id,
		battery_level,
		battery_status,
	});
}
