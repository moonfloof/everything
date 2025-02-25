import { v4 as uuid } from 'uuid';
import type { Optional } from '../types/database.js';
import { getStatement } from './database.js';

interface Device {
	id: string;
	description: string;
	api_key: string;
	battery_level: Optional<number>;
	battery_status: Optional<string>;
	updated_at: string;
}

export function validateDevice(api_key?: string) {
	const statement = getStatement<Device>(
		'validateDevice',
		'SELECT * FROM devices WHERE api_key = $api_key LIMIT 1',
	);

	const device = statement.get({ api_key });

	if (device === undefined) {
		throw new Error('Device not found');
	}

	return device;
}

export function getDevices() {
	const statement = getStatement<Omit<Device, 'api_key'>>(
		'getDevices',
		`SELECT id, description, battery_level, battery_status, updated_at
		FROM devices
		ORDER BY updated_at DESC`,
	);

	return statement.all();
}

export function getDeviceCount() {
	const statement = getStatement<{ total: number }>('getDeviceCount', 'SELECT count(*) as total FROM devices');
	return statement.get()?.total || 0;
}

export function updateDevice(id: string, battery_level: number, battery_status: string | null) {
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

export function addNewDevice(description: string, api_key: string) {
	const id = uuid();
	const statement = getStatement(
		'addNewDevice',
		`INSERT INTO devices
		(id, description, api_key, updated_at)
		VALUES
		($id, $description, $api_key, $updated_at);`,
	);

	const result = statement.run({
		id,
		description,
		api_key,
		updated_at: new Date().toISOString(),
	});

	return {
		...result,
		id,
	};
}
