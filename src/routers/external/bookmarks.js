import express from 'express';
import { validateDevice } from '../../database/devices.js';
import { insertBookmark } from '../../database/bookmarks.js';
import Logger from '../../lib/logger.js';

const log = new Logger('Bookmarks');

const router = express.Router();

router.post('/', (req, res) => {
	try {
		const { apiKey, title, url } = req.body;
		const { id: deviceId } = validateDevice(apiKey);

		log.info(`Adding '${title}`);
		insertBookmark(title, url, deviceId);
		res.send({ status: 'ok' });
	} catch (err) {
		log.error(err);
		res.status(400).send({ status: err.message });
	}
});

export default router;
