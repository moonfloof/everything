import express from 'express';
import { countWeight, deleteWeight, getWeight, insertWeight, updateWeight } from '../../database/weight.js';
import { config } from '../../lib/config.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import type { RequestFrontend } from '../../types/express.js';

const router = express.Router();

// FRONTEND

router.get('/', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countWeight());

	const weight = getWeight({ page });

	res.render('internal/weight', { weight, pagination });
});

// CRUD

router.post('/', (req: RequestFrontend, res) => {
	const { weight_kgs, created_at } = req.body;

	insertWeight({
		weight_kgs: Number(weight_kgs || 0),
		created_at,
		device_id: config.defaultDeviceId,
	});

	res.redirect('/weight');
});

router.post('/:id', (req: RequestFrontend, res) => {
	const { id } = req.params;
	const { crudType, weight_kgs, created_at } = req.body;

	switch (crudType) {
		case 'delete': {
			deleteWeight(id);
			break;
		}

		case 'update': {
			updateWeight({ id, weight_kgs: Number(weight_kgs || 0), created_at });
			break;
		}

		default:
			// Do nothing
			break;
	}

	res.redirect('/weight');
});

export default router;
