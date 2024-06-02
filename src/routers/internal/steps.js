import express from 'express';
import { countSteps, deleteSteps, getSteps, insertSteps, updateSteps } from '../../database/steps.js';
import { shortDate } from '../../lib/formatDate.js';
import { generateBarGraph } from '../../lib/graphs/bar.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';

const router = express.Router();

// FRONTEND

router.get('/', (req, res) => {
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

router.post('/', (req, res) => {
	const { step_count_total, created_at } = req.body;

	insertSteps(step_count_total, created_at || Date.now(), process.env.TOMBOIS_DEFAULT_DEVICE_ID);

	res.redirect('/steps');
});

router.post('/:id', (req, res) => {
	const { id } = req.params;
	const { crudType, step_count_total, created_at } = req.body;

	switch (crudType) {
		case 'delete': {
			deleteSteps(id);
			break;
		}

		case 'update': {
			updateSteps(id, step_count_total, created_at);
			break;
		}

		default:
			// Do nothing
			break;
	}

	res.redirect('/steps');
});

export default router;
