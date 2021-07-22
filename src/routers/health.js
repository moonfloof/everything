import express from 'express';
import { validateDevice } from '../database/devices.js';
import { insertSleepCycle } from '../database/sleep.js';
import Logger from '../lib/logger.js';

const log = new Logger('Health');

const router = express.Router();

const validateAuth = (req, res, next) => {
	try {
		// Validate Device API Key
		const authToken = req.header('Authorization')?.toLowerCase();
		const { id } = validateDevice(authToken);
		req.deviceId = id;
		next();
	} catch (err) {
		res.status(401).send({ status: err.message });
		return;
	}
};

router.post('/sleep', validateAuth, (req, res) => {
	try {
		const { createdAt, type } = req.body;

		log.info(`Sleeping: '${type}' at '${createdAt}'`);
		insertSleepCycle(createdAt, type, req.deviceId);

		res.send({ status: 'ok' });
	} catch (err) {
		log.error(err);
		res.status(400).send({ status: err.message });
	}
});

export default router;
