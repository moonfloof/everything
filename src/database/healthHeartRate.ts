import type { Insert } from '../types/database.js';
import { getStatement } from './database.js';

interface HeartRate {
	rate: number;
	created_at: number;
}

export function insertHeartRate(heartrate: Insert<HeartRate>) {
	const statement = getStatement(
		'insertHeartRate',
		`INSERT INTO health_heartrate
		(rate, created_at)
		VALUES
		($rate, $created_at)`,
	);

	return statement.run(heartrate);
}

export function countHeartRate() {
	const statement = getStatement<{ total: number }>(
		'countHeartRate',
		'SELECT COUNT(*) as total FROM health_heartrate',
	);

	return statement.get()?.total || 0;
}
