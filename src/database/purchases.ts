import { v4 as uuid } from 'uuid';
import { dateDefault } from '../lib/formatDate.js';
import type { Insert, Optional, Update } from '../types/database.js';
import { type Parameters, calculateGetParameters } from './constants.js';
import { getStatement } from './database.js';

interface Purchase {
	id: string;
	amount: number;
	merchant: string;
	category: Optional<string>;
	currency: string;
	created_at: string;
	device_id: string;
}

export function insertPurchase(purchase: Insert<Purchase>) {
	const statement = getStatement(
		'insertPurchase',
		`INSERT INTO purchases
		(id, amount, merchant, category, currency, created_at, device_id)
		VALUES
		($id, $amount, $merchant, $category, $currency, $created_at, $device_id)`,
	);

	return statement.run({
		...purchase,
		id: uuid(),
		created_at: dateDefault(purchase.created_at),
	});
}

export function countPurchases() {
	const statement = getStatement<{ total: number }>('countPurchases', 'SELECT COUNT(*) as total FROM purchases');

	return statement.get()?.total || 0;
}

export function getPurchases(parameters: Parameters = {}) {
	const statement = getStatement<Purchase>(
		'getPurchases',
		`SELECT * FROM purchases
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY created_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters));
}

export function deletePurchase(id: string) {
	const statement = getStatement('deletePurchase', 'DELETE FROM purchases WHERE id = $id');

	return statement.run({ id });
}

export function updatePurchase(purchase: Update<Purchase>) {
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
		...purchase,
		created_at: dateDefault(purchase.created_at),
	});
}
