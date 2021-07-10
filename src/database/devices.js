import { getDatabase } from './getDatabase.js';

export async function validateDevice (apiKey) {
	const db = await getDatabase();

	const statement = await db.prepare('SELECT * FROM devices WHERE api_key = $apiKey LIMIT 1');
	await statement.bind({ $apiKey: apiKey });
	const device = await statement.get();

	if (device === undefined) {
		throw new Error('Device not found');
	}

	return device;
}
