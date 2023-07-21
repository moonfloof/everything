import express from 'express';

import { countPurchases, deletePurchase, getPurchases, insertPurchase, updatePurchase } from '../../database/purchases.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';

const router = express.Router();

// FRONTEND

router.get('/', (req, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countPurchases());

	const purchases = getPurchases({ page });

	res.render('internal/purchases', { purchases, pagination });
});

// CRUD

router.post('/', (req, res) => {
	const { amount, currency, merchant, category, created_at } = req.body;

	insertPurchase(
		amount,
		merchant,
		category,
		currency,
		created_at || new Date().toISOString(),
		process.env.TOMBOIS_DEFAULT_DEVICE_ID,
	);

	res.redirect('/purchases');
});

router.post('/:purchaseId', (req, res) => {
	const { purchaseId } = req.params;
	const { crudType, amount, currency, merchant, category, created_at } = req.body;

	switch (crudType) {
		case 'delete':
			deletePurchase(purchaseId);
			break;

		case 'update':
			updatePurchase(purchaseId, amount, currency, merchant, category, created_at);
			break;

		default:
			// Do nothing
			break;
	}

	res.redirect('/purchases');
});

export default router;
