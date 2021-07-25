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

export function getPurchases (purchaseId, page) {
	const statement = getStatement('getPurchases', `
		SELECT * FROM purchases
		WHERE id LIKE $id
		ORDER BY created_at DESC
		LIMIT 50 OFFSET $offset
	`);

	const id = purchaseId || '%';
	const offset = page ? (page - 1) * 50 : 0;

	return statement.all({ id, offset });
}
