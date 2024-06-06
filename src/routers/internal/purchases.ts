import express from 'express';

import {
	countPurchases,
	deletePurchase,
	getPurchases,
	insertPurchase,
	updatePurchase,
} from '../../database/purchases.js';
import { config } from '../../lib/config.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import type { RequestFrontend } from '../../types/express.js';

const router = express.Router();

// FRONTEND

router.get('/', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countPurchases());

	const purchases = getPurchases({ page });

	res.render('internal/purchases', { purchases, pagination });
});

// CRUD

router.post('/', (req: RequestFrontend, res) => {
	const { amount, currency, merchant, category, created_at } = req.body;

	insertPurchase({
		amount: Number(amount),
		merchant,
		category,
		currency,
		created_at,
		device_id: config.defaultDeviceId,
	});

	res.redirect('/purchases');
});

router.post('/:id', (req: RequestFrontend, res) => {
	const { id } = req.params;
	const { crudType, amount, currency, merchant, category, created_at } = req.body;

	switch (crudType) {
		case 'delete': {
			deletePurchase(id);
			break;
		}

		case 'update': {
			updatePurchase({ id, amount: Number(amount), currency, merchant, category, created_at });
			break;
		}

		default:
			// Do nothing
			break;
	}

	res.redirect('/purchases');
});

export default router;
