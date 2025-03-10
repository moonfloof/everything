import express from 'express';
import { countSteps, deleteSteps, getSteps, insertSteps, updateSteps } from '../../database/steps.js';
import { config } from '../../lib/config.js';
import { shortDate } from '../../lib/formatDate.js';
import { generateBarGraph } from '../../lib/graphs/bar.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import type { RequestFrontend } from '../../types/express.js';

const router = express.Router();

// FRONTEND

router.get('/', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countSteps());

	const steps = getSteps({ page });

	const svg = generateBarGraph(
		steps.map(s => ({
			label: shortDate(new Date(s.created_at)),
			y: s.step_count_total,
		})),
		'daily steps',
	);

	res.render('internal/steps', { steps, pagination, svg });
});

// CRUD

interface Steps {
	crudType?: 'update' | 'delete';
	step_count_total: string;
	created_at: string;
}

router.post('/', (req: RequestFrontend<object, Steps>, res) => {
	const { step_count_total, created_at } = req.body;

	insertSteps({ step_count_total: Number(step_count_total || 0), created_at, device_id: config.defaultDeviceId });

	res.redirect('/steps');
});

router.post('/:id', (req: RequestFrontend<object, Steps, { id: string }>, res) => {
	const { id } = req.params;
	const { crudType, step_count_total, created_at } = req.body;

	switch (crudType) {
		case 'delete': {
			deleteSteps(id);
			break;
		}

		case 'update': {
			updateSteps({ id, step_count_total: Number(step_count_total || 0), created_at });
			break;
		}

		default:
			// Do nothing
			break;
	}

	res.redirect('/steps');
});

export default router;
