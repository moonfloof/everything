import express from 'express';

import { deletePurchase, getPurchases, updatePurchase } from '../../database/purchases.js';

const router = express.Router();

// FRONTEND

router.get('/', (req, res) => {
	const purchases = getPurchases(undefined, req.query.page);
	res.render('internal/purchases', { purchases });
});

// CRUD

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
