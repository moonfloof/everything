import express from 'express';
import { insertPurchase } from '../../database/purchases.js';
import { config } from '../../lib/config.js';
import Logger from '../../lib/logger.js';

const log = new Logger('Purchases');

const router = express.Router();

router.post('/', (req, res) => {
	try {
		const { type, data } = req.body;

		if (type !== 'transaction.created') {
			log.info(`Received webhook with type: '${type}'. Quietly ignoring`);
			res.send({ status: 'ok' });
			return;
		}

		const { account_id, currency, category } = data;

		if (account_id !== process.env.TOMBOIS_MONZO_ACCOUNT_ID) {
			throw new Error(`Unexpected account ID '${account_id}'`);
		}

		const amount = -(Number(data.amount) || 0) / 100;
		const created_at = new Date(data.created).toISOString();
		const merchant = data.merchant?.name ?? data.description;

		log.info(`Adding purchase of ${amount} ${currency} at ${merchant}`);
		insertPurchase({
			amount: amount,
			merchant,
			category,
			currency,
			created_at,
			device_id: config.defaultDeviceId,
		});

		res.send({ status: 'ok' });
	} catch (err) {
		log.error(err);
		res.status(400).send({ status: (err as Error).message });
	}
});

export default router;
