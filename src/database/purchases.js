import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import { calculateGetParameters } from './constants.js';

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

/**
 * Fetch purchases
 *
 * @export
 * @param {object} parameters
 * @param {string} [parameters.id]
 * @param {number} [parameters.page]
 * @param {number} [parameters.limit]
 * @param {number} [parameters.days]
 */
export function getPurchases (parameters) {
	const statement = getStatement(
		'getPurchases',
		`SELECT * FROM purchases
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY created_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters));
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
