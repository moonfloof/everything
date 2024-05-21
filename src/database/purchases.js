import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import { calculateGetParameters } from './constants.js';

/**
 * @param {number} amount
 * @param {string} merchant
 * @param {string} category
 * @param {string} currency
 * @param {string} created_at
 * @param {string} device_id
 * @return {import('better-sqlite3').RunResult}
 */
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

/** @return {number} */
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

/**
 * @param {string} id
 * @return {import('better-sqlite3').RunResult}
 */
export function deletePurchase (id) {
	const statement = getStatement(
		'deletePurchase',
		'DELETE FROM purchases WHERE id = $id',
	);

	return statement.run({ id });
}

/**
 * @param {string} id
 * @param {number} amount
 * @param {string} currency
 * @param {string} merchant
 * @param {string} category
 * @param {string} created_at
 * @return {import('better-sqlite3').RunResult}
 */
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
