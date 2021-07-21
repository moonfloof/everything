import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';

export function insertPurchase (amount, merchant, category, currency, createdAt, deviceId) {
	const statement = getStatement(
		'insertPurchase',
		`INSERT INTO purchases
		(id, amount, merchant, category, currency, created_at, device_id)
		VALUES
		($id, $amount, $merchant, $category, $currency, $createdAt, $deviceId)`,
	);

	return statement.run({
		id: uuid(),
		amount,
		merchant,
		category,
		currency,
		createdAt,
		deviceId,
	});
}
