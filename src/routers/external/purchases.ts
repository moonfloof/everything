import express from 'express';
import { insertPurchase } from '../../database/purchases.js';
import { config } from '../../lib/config.js';
import Logger from '../../lib/logger.js';
import { validateDevice } from '../../database/devices.js';

const log = new Logger('Purchases');

const router = express.Router();

router.post('/', (req, res) => {
	try {
		const { type, data } = req.body;
		const { apiKey } = req.query;
		const device = validateDevice(apiKey as string | undefined);

		if (type !== 'transaction.created') {
			log.info(`Received webhook with type: '${type}'. Quietly ignoring`);
			res.send({ status: 'ok' });
			return;
		}

		const { account_id, currency, category } = data;

		if (account_id !== config.monzo.accountId) {
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
			device_id: device.id,
		});

		res.send({ status: 'ok' });
	} catch (err) {
		log.error(err);
		res.status(400).send({ status: (err as Error).message });
	}
});

export default router;
