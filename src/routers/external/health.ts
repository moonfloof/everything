import express, { type Request, type Response, type NextFunction } from 'express';
import { validateDevice } from '../../database/devices.js';
import { insertFood } from '../../database/food.js';
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
		const authToken = req.header('Authorization');
		if (!authToken) throw new Error('Please provide an authorization token');
		const { id } = validateDevice(authToken);
		req.body.device_id = id;
		next();
	} catch (err) {
		res.status(401).send({ status: (err as Error).message });
		return;
	}
};

router.use(trimStrings);
router.use(validateAuth);

router.post('/steps', (req: RequestFrontend<object, { created_at: string; steps: number; device_id: string }>, res) => {
	const { created_at, steps, device_id } = req.body;

	log.info(`Steps: ${steps} ${created_at ? `at '${created_at}'` : ''}`);
	insertSteps({ step_count_total: steps, created_at, device_id });

	res.send({ status: 'ok' });
});

router.post(
	'/weight',
	(req: RequestFrontend<object, { created_at: string; weight_kgs: number; device_id: string }>, res) => {
		const { created_at, weight_kgs, device_id } = req.body;

		log.info(`Weight: '${weight_kgs}' ${created_at ? `at '${created_at}'` : ''}`);
		insertWeight({ weight_kgs, created_at, device_id });

		res.send({ status: 'ok' });
	},
);

router.post('/time', (req: RequestFrontend, res) => {
	const { created_at, ended_at, category, device_id } = req.body;

	log.info(`Time: ${category} started at ${created_at}`);
	insertTimeTracking({ category: category || 'Stop', created_at, ended_at, device_id });

	res.send({ status: 'ok' });
});

router.post('/food', (req: RequestFrontend, res) => {
	const { created_at, name, type, device_id } = req.body;

	log.info(`Food: ${name} (${type}) ${created_at ? `at '${created_at}'` : ''}`);
	insertFood({ name, type, created_at, device_id });

	res.send({ status: 'ok' });
});

router.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
	log.error(err);
	res.status(400).send({ status: err.message });
});

export default router;
