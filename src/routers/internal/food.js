import express from 'express';
import { countFood, deleteFood, getFood, insertFood, updateFood } from '../../database/food.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';

const router = express.Router();

// FRONTEND

router.get('/', (req, res) => {
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

router.post('/', (req, res) => {
	const { name, type, created_at } = req.body;

	insertFood(name, type, created_at, process.env.TOMBOIS_DEFAULT_DEVICE_ID);

	res.redirect('/food');
});

router.post('/:id', (req, res) => {
	const { id } = req.params;
	const { crudType, name, type, created_at } = req.body;

	switch (crudType) {
		case 'delete':
			deleteFood(id);
			break;

		case 'update':
			updateFood(id, name, type, created_at);
			break;

		default:
			// Do nothing
			break;
	}

	res.redirect('/food');
});

export default router;
