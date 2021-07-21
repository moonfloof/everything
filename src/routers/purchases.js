import express from 'express';
import { insertPurchase } from '../database/purchases.js';
import Logger from '../lib/logger.js';

const log = new Logger('Purchases');

const router = express.Router();

router.post('/', (req, res) => {
	try {
		const { type, data } = req.body;

		if (type !== 'transaction.created') {
			throw new Error('Unrecognised webhook type');
		}

		const { account_id, amount, created, currency, category, merchant } = data;

		if (account_id !== process.env.TOMBOIS_MONZO_ACCOUNT_ID) {
			throw new Error(`Unexpected account ID '${account_id}'`);
		}

		const amountPounds = -(Number(amount) || 0) / 100;
		const createdAt = new Date(created).toISOString();
		const deviceId = process.env.TOMBOIS_DEFAULT_DEVICE_ID;

		log.info(`Adding purchase of ${amountPounds} ${currency} at ${merchant.name}`);
		insertPurchase(amountPounds, merchant.name, category, currency, createdAt, deviceId);

		res.send({ status: 'ok' });
	} catch (err) {
		log.error(err);
		res.status(400).send({ status: err.message });
	}
});

export default router;
