import assert from 'node:assert';
import express, { type NextFunction, type Request, type Response } from 'express';
import { validateDevice } from '../../database/devices.js';
import { insertFood } from '../../database/food.js';
import { insertHeartRate } from '../../database/healthHeartRate.js';
import { insertSteps } from '../../database/steps.js';
import { insertTimeTracking } from '../../database/timetracking.js';
import { insertWeight } from '../../database/weight.js';
import Logger from '../../lib/logger.js';
import { trimStrings } from '../../lib/middleware/trimStrings.js';
import type { RequestFrontend } from '../../types/express.js';

const log = new Logger('Health');

const router = express.Router();

const validateAuth = (req: Request, res: Response, next: NextFunction) => {
	// Validate Device API Key
	try {
		const authToken = req.headers.authorization;
		if (!authToken) throw new Error('Please provide an authorization token');
		const { id } = validateDevice(authToken);
		res.locals.device_id = id;
		next();
	} catch (err) {
		res.status(401).send({ status: (err as Error).message });
		return;
	}
};

router.use(trimStrings);
router.use(validateAuth);

router.post('/steps', (req: RequestFrontend<object, { created_at: string; steps: number }>, res) => {
	const { created_at, steps } = req.body;
	const { device_id } = res.locals;

	log.info(`Steps: ${steps} ${created_at ? `at '${created_at}'` : ''}`);
	insertSteps({ step_count_total: steps, created_at, device_id });

	res.send({ status: 'ok' });
});

router.post('/weight', (req: RequestFrontend<object, { created_at: string; weight_kgs: number }>, res) => {
	const { created_at, weight_kgs } = req.body;
	const { device_id } = res.locals;

	log.info(`Weight: '${weight_kgs}' ${created_at ? `at '${created_at}'` : ''}`);
	insertWeight({ weight_kgs, created_at, device_id });

	res.send({ status: 'ok' });
});

router.post('/time', (req: RequestFrontend, res) => {
	const { created_at, ended_at, category } = req.body;
	const { device_id } = res.locals;

	log.info(`Time: ${category} started at ${created_at}`);
	insertTimeTracking({ category: category || 'Stop', created_at, ended_at, device_id });

	res.send({ status: 'ok' });
});

router.post('/food', (req: RequestFrontend, res) => {
	const { created_at, name, type } = req.body;
	const { device_id } = res.locals;

	log.info(`Food: ${name} (${type}) ${created_at ? `at '${created_at}'` : ''}`);
	insertFood({ name, type, created_at, device_id });

	res.send({ status: 'ok' });
});

interface HeartRatePayload {
	history: { rate: number; created_at: string | number }[] | string;
	format?: 'json' | 'csv';
}

router.post('/heartrate', (req: RequestFrontend<object, HeartRatePayload>, res) => {
	let { history, format } = req.body;
	if (typeof history === 'string') {
		switch (format) {
			case 'csv': {
				history = history.split('\n').map(line => {
					let [rate, created_at] = line.split(',') as (string | number)[];
					assert(
						rate !== undefined && created_at !== undefined,
						'Malformed CSV. Make sure each line provided is in the format: rate,createdat',
					);

					// Heart rate MUST be a number
					rate = Number(rate);
					assert(
						!Number.isNaN(rate),
						'Malformed CSV. Provided heart rate is not a number',
					);

					// Convert to number, in case we're providing a unix timestamp
					if (!Number.isNaN(Number(created_at))) {
						created_at = Number(created_at);
					}

					return { rate, created_at };
				});
				break;
			}
			case 'json': {
				history = JSON.parse(history);
				break;
			}
			default: {
				throw new Error(
					'Please provide a format of either "json" or "csv" if history is a string',
				);
			}
		}
	}

	assert(typeof history !== 'string', 'Something went wrong while parsing the `history` value');

	for (const { rate, created_at } of history) {
		// Determine if the timestamp was provided using seconds, by checking if
		// the raw value is before the year 2000.
		const isUsingSeconds = typeof created_at === 'number' && created_at < 946684800000;
		const timestamp = new Date(isUsingSeconds ? created_at * 1000 : created_at).getTime();
		insertHeartRate({ rate, created_at: timestamp });
	}

	res.send({ status: 'ok' });
});

router.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
	log.error(err);
	res.status(400).send({ status: err.message });
});

export default router;
