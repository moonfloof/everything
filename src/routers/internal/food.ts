import express from 'express';
import { countFood, deleteFood, getFood, insertFood, updateFood } from '../../database/food.js';
import { config } from '../../lib/config.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import type { RequestFrontend } from '../../types/express.js';

const router = express.Router();

// FRONTEND

router.get('/', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countFood());

	const typeValues = [
		// Basics
		'food',
		'drink',

		// Specific Drink Types
		'soft drink',
		'coffee',
		'tea',

		// Specific Food Types
		'takeaway',
		'snack',
	];

	const food = getFood({ page });

	res.render('internal/food', { food, pagination, typeValues });
});

// CRUD

router.post('/', (req: RequestFrontend, res) => {
	const { name, type, created_at } = req.body;

	insertFood({ name, type, created_at, device_id: config.defaultDeviceId });

	res.redirect('/food');
});

router.post('/:id', (req: RequestFrontend, res) => {
	const { id } = req.params;
	const { crudType, name, type, created_at } = req.body;

	switch (crudType) {
		case 'delete': {
			deleteFood(id);
			break;
		}

		case 'update': {
			updateFood({ id, name, type, created_at });
			break;
		}

		default:
			// Do nothing
			break;
	}

	res.redirect('/food');
});

export default router;
