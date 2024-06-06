import express from 'express';
import { insertBookmark } from '../../database/bookmarks.js';
import { validateDevice } from '../../database/devices.js';
import Logger from '../../lib/logger.js';
import type { RequestFrontend } from '../../types/express.js';

const log = new Logger('Bookmarks');

const router = express.Router();

router.post('/', (req: RequestFrontend, res) => {
	try {
		const { apiKey, title, url, created_at } = req.body;
		const { id: device_id } = validateDevice(apiKey);

		log.info(`Adding '${title}`);
		insertBookmark({ title, url, device_id, created_at });
		res.send({ status: 'ok' });
	} catch (err) {
		const error = err as Error;
		log.error(error);
		res.status(400).send({ status: error.message });
	}
});

export default router;
