import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import { calculateOffset, RECORDS_PER_PAGE } from './constants.js';

export function insertPurchase (amount, merchant, category, currency, created_at, device_id) {
	const statement = getStatement(
		'insertPurchase',
		`INSERT INTO purchases
		(id, amount, merchant, category, currency, created_at, device_id)
		VALUES
		($id, $amount, $merchant, $category, $currency, $created_at, $device_id)`,
	);

	return statement.run({
		id: uuid(),
		amount,
		merchant,
		category,
		currency,
		created_at,
		device_id,
	});
}

export function countPurchases () {
	const statement = getStatement(
		'countPurchases',
		'SELECT COUNT(*) as total FROM purchases',
	);

	return statement.get().total;
}

export function getPurchases (id, page) {
	const statement = getStatement(
		'getPurchases',
		`SELECT * FROM purchases
		WHERE id LIKE $id
		ORDER BY created_at DESC
		LIMIT ${RECORDS_PER_PAGE} OFFSET $offset`,
	);

	return statement.all({
		id: id || '%',
		offset: calculateOffset(page),
	});
}

export function deletePurchase (id) {
	const statement = getStatement(
		'deletePurchase',
		'DELETE FROM purchases WHERE id = $id',
	);

	return statement.run({ id });
}

export function updatePurchase (id, amount, currency, merchant, category, created_at) {
	const statement = getStatement(
		'updatePurchase',
		`UPDATE purchases
		SET amount = $amount,
		    currency = $currency,
		    merchant = $merchant,
		    category = $category,
		    created_at = $created_at
		WHERE id = $id`,
	);

	return statement.run({
		id,
		amount,
		currency,
		merchant,
		category,
		created_at,
	});
}
