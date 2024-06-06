import express from 'express';
import {
	categoryValues,
	countTimeTracking,
	deleteTimeTracking,
	getTimeTracking,
	insertTimeTracking,
	updateTimeTracking,
} from '../../database/timetracking.js';
import { config } from '../../lib/config.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import type { RequestFrontend } from '../../types/express.js';

const router = express.Router();

// FRONTEND

router.get('/', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countTimeTracking());

	const timetracking = getTimeTracking({ page });

	res.render('internal/timetracking', { timetracking, pagination, categoryValues });
});

// CRUD

router.post('/', (req: RequestFrontend, res) => {
	const { category, created_at, ended_at } = req.body;

	insertTimeTracking({ category, created_at, ended_at, device_id: config.defaultDeviceId });

	res.redirect('/timetracking');
});

router.post('/:id', (req: RequestFrontend, res) => {
	const { id } = req.params;
	const { crudType, category, created_at, ended_at } = req.body;

	switch (crudType) {
		case 'delete': {
			deleteTimeTracking(id);
			break;
		}

		case 'update': {
			updateTimeTracking({ id, category, created_at, ended_at });
			break;
		}

		default:
			// Do nothing
			break;
	}

	res.redirect('/timetracking');
});

export default router;
