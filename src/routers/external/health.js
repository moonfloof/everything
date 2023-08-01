import express from 'express';
import { validateDevice } from '../../database/devices.js';
import { insertFood } from '../../database/food.js';
import { insertSteps } from '../../database/steps.js';
import { insertTimeTracking } from '../../database/timetracking.js';
import { insertWeight } from '../../database/weight.js';
import Logger from '../../lib/logger.js';
import { trimStrings } from '../../lib/middleware/trimStrings.js';

const log = new Logger('Health');

const router = express.Router();

const validateAuth = (req, res, next) => {
	try {
		// Validate Device API Key
		const authToken = req.header('Authorization');
		const { id } = validateDevice(authToken);
		req.deviceId = id;
		next();
	} catch (err) {
		res.status(401).send({ status: err.message });
		return;
	}
};

router.use(trimStrings);
router.use(validateAuth);

router.post('/steps', (req, res) => {
	try {
		const { createdAt, steps } = req.body;

		log.info(`Steps: ${steps} at '${createdAt}`);

		insertSteps(steps, createdAt, req.deviceId);

		res.send({ status: 'ok' });
	} catch (err) {
		log.error(err);
		res.status(400).send({ status: err.message });
	}
});

router.post('/weight', (req, res) => {
	try {
		const { createdAt, weightKgs } = req.body;

		log.info(`Weight: '${weightKgs}' at '${createdAt}'`);
		insertWeight(weightKgs, createdAt, req.deviceId);

		res.send({ status: 'ok' });
	} catch (err) {
		log.error(err);
		res.status(400).send({ status: err.message });
	}
});

router.post('/time', (req, res) => {
	try {
		const { createdAt, endedAt, category } = req.body;

		log.info(`Time: ${category} started at ${createdAt}`);
		insertTimeTracking(category, createdAt, endedAt, req.deviceId);

		res.send({ status: 'ok' });
	} catch (err) {
		log.error(err);
		res.status(400).send({ status: err.message });
	}
});

router.post('/food', (req, res) => {
	try {
		const { createdAt, name, type } = req.body;

		log.info(`Food: ${name} (${type}) started at ${createdAt}`);
		insertFood(name, type, createdAt, req.deviceId);

		res.send({ status: 'ok' });
	} catch (err) {
		log.error(err);
		res.status(400).send({ status: err.message });
	}
});

export default router;
