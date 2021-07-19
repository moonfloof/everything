import { getStatement } from './database.js';

export function validateDevice (apiKey) {
	const statement = getStatement(
		'validateDevice',
		'SELECT * FROM devices WHERE api_key = $apiKey LIMIT 1',
	);

	const device = statement.get({ apiKey });

	if (device === undefined) {
		throw new Error('Device not found');
	}

	return device;
}
