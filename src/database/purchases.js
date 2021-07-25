import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import { RECORDS_PER_PAGE } from './constants.js';

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

export function countPurchases () {
	const statement = getStatement(
		'countPurchases',
		'SELECT COUNT(*) as total FROM purchases',
	);

	return statement.get().count;
}

export function getPurchases (purchaseId, page) {
	const statement = getStatement('getPurchases', `
		SELECT * FROM purchases
		WHERE id LIKE $id
		ORDER BY created_at DESC
		LIMIT ${RECORDS_PER_PAGE} OFFSET $offset
	`);

	const id = purchaseId || '%';
	const offset = page ? (page - 1) * RECORDS_PER_PAGE : 0;

	return statement.all({ id, offset });
}

export function deletePurchase (id) {
	const statement = getStatement(
		'deletePurchase',
		'DELETE FROM purchases WHERE id = $id',
	);

	return statement.run({ id });
}


export function updatePurchase (id, amount, currency, merchant, category, createdAt) {
	const statement = getStatement(
		'updatePurchase',
		`UPDATE purchases
		SET amount = $amount,
		    currency = $currency,
		    merchant = $merchant,
		    category = $category,
		    created_at = $createdAt
		WHERE id = $id`,
	);

	return statement.run({
		id,
		amount,
		currency,
		merchant,
		category,
		createdAt,
	});
}
