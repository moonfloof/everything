import express from 'express';
import {
	categoryValues,
	countTimeTracking,
	deleteTimeTracking,
	getTimeTracking,
	insertTimeTracking,
	updateTimeTracking,
} from '../../database/timetracking.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';

const router = express.Router();

// FRONTEND

router.get('/', (req, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countTimeTracking());

	const timetracking = getTimeTracking({ page });

	res.render('internal/timetracking', { timetracking, pagination, categoryValues });
});

// CRUD

router.post('/', (req, res) => {
	const { category, created_at, ended_at } = req.body;

	insertTimeTracking(category, created_at || Date.now(), ended_at, process.env.TOMBOIS_DEFAULT_DEVICE_ID);

	res.redirect('/timetracking');
});

router.post('/:id', (req, res) => {
	const { id } = req.params;
	const { crudType, category, created_at, ended_at } = req.body;

	switch (crudType) {
		case 'delete':
			deleteTimeTracking(id);
			break;

		case 'update':
			updateTimeTracking(id, category, created_at, ended_at);
			break;

		default:
			// Do nothing
			break;
	}

	res.redirect('/timetracking');
});

export default router;
