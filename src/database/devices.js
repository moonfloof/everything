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
