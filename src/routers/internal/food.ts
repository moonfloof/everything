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
		{ value: 'food', label: 'Food' },
		{ value: 'drink', label: 'Drink' },

		// Specific Drink Types
		{ value: 'soft drink', label: 'Soft Drink' },
		{ value: 'coffee', label: 'Coffee' },
		{ value: 'tea', label: 'Tea' },

		// Specific Food Types
		{ value: 'takeaway', label: 'Takeaway' },
		{ value: 'snack', label: 'Snack' },
	];

	const food = getFood({ page });

	res.render('internal/food', { food, pagination, typeValues });
});

// CRUD

interface Food {
	crudType?: 'update' | 'delete';
	name: string;
	type: string;
	created_at: string;
}

router.post('/', (req: RequestFrontend<object, Food>, res) => {
	const { name, type, created_at } = req.body;

	insertFood({ name, type, created_at, device_id: config.defaultDeviceId });

	res.redirect('/food');
});

router.post('/:id', (req: RequestFrontend<object, Food, { id: string }>, res) => {
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
