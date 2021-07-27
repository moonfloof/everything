import express from 'express';
import { validateDevice } from '../../database/devices.js';
import { insertSleepCycle } from '../../database/sleep.js';
import { insertSteps } from '../../database/steps.js';
import { insertTimeTracking } from '../../database/timetracking.js';
import { insertWeight } from '../../database/weight.js';
import Logger from '../../lib/logger.js';

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

router.post('/sleep', validateAuth, (req, res) => {
	try {
		const { createdAt, type, stepsToday } = req.body;

		log.info(`${type} at '${createdAt}'`);

		const isSleep = type?.toLowerCase() === 'sleep';
		insertSleepCycle(createdAt, isSleep, req.deviceId);

		// This gets logged in the "sleep" API request because
		// this request gets sent once per day when no more steps will
		// be taken. It's the perfect opportunity.
		if (stepsToday && isSleep) {
			insertSteps(stepsToday, createdAt, req.deviceId);
		}

		res.send({ status: 'ok' });
	} catch (err) {
		log.error(err);
		res.status(400).send({ status: err.message });
	}
});

router.post('/weight', validateAuth, (req, res) => {
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

router.post('/time', validateAuth, (req, res) => {
	try {
		const { createdAt, category } = req.body;

		log.info(`Time: ${category} started at ${createdAt}`);
		insertTimeTracking(category, createdAt, req.deviceId);

		res.send({ status: 'ok' });
	} catch (err) {
		log.error(err);
		res.status(400).send({ status: err.message });
	}
});

export default router;
