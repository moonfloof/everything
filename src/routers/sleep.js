import express from 'express';
import { validateDevice } from '../database/devices.js';
import { insertSleepCycle } from '../database/sleep.js';
import Logger from '../lib/logger.js';

const log = new Logger('Sleep');

const router = express.Router();

router.post('/', (req, res) => {
	try {
		// Validate Device API Key
		const authToken = req.header('Authorization')?.toLowerCase();
		const { id: deviceId } = validateDevice(authToken);

		const { timestamp, type } = req.body;

		log.info(`Logging '${type}' at '${timestamp}'`);
		insertSleepCycle(timestamp, type, deviceId);

		res.send({ status: 'ok' });
	} catch (err) {
		log.error(err);
		res.send({ status: err.message });
	}
});

export default router;
