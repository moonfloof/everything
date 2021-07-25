import express from 'express';
import { countSleepCycles, deleteSleepCycle, getSleepCycles, insertSleepCycle, updateSleepCycle } from '../../database/sleep.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';

const router = express.Router();

// FRONTEND

router.get('/', (req, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countSleepCycles());

	const sleep = getSleepCycles(undefined, page);

	res.render('internal/sleep', { sleep, pagination });
});

// CRUD

router.post('/', (req, res) => {
	const { started_at, ended_at } = req.body;

	insertSleepCycle(started_at, 'sleep', process.env.TOMBOIS_DEFAULT_DEVICE_ID);
	insertSleepCycle(ended_at, 'wake', process.env.TOMBOIS_DEFAULT_DEVICE_ID);

	res.redirect('/sleep');
});

router.post('/:id', (req, res) => {
	const { id } = req.params;
	const { crudType, started_at, ended_at } = req.body;

	switch (crudType) {
		case 'delete':
			deleteSleepCycle(id);
			break;

		case 'update':
			updateSleepCycle(id, started_at, ended_at);
			break;

		default:
			// Do nothing
			break;
	}

	res.redirect('/sleep');
});

export default router;
