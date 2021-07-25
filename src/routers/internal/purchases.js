import express from 'express';

import { getPurchases } from '../../database/purchases.js';

const router = express.Router();

// FRONTEND

router.get('/', (req, res) => {
	const purchases = getPurchases(undefined, req.query.page);
	res.render('internal/purchases', { purchases });
});

export default router;
