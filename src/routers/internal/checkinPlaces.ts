import { Router } from 'express';
import {
	countCheckinPlaces,
	deleteCheckinPlace,
	getCheckinPlaces,
	getPlaceCategories,
	insertPlace,
	updateCheckinPlace,
} from '../../database/checkinPlace.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import type { RequestFrontend } from '../../types/express.js';

const router = Router();

// Frontend

router.get('/', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countCheckinPlaces());
	const places = getCheckinPlaces({ page });
	const categories = getPlaceCategories();

	res.render('internal/checkin-places', { places, categories, pagination });
});

// CRUD

interface Place {
	crudType?: 'update' | 'delete';
	name: string;
	category: string;
	address: string;
	lat: string;
	long: string;
	external_id: string;
	created_at: string;
	updated_at: string;
}

router.post('/', (req: RequestFrontend<object, Place>, res) => {
	const { name, category, address, lat, long, external_id } = req.body;

	if (!(name && category)) {
		throw new Error('Name and category are required fields');
	}

	insertPlace({
		name,
		category,
		address,
		lat: lat ? Number(lat) : null,
		long: long ? Number(long) : null,
		external_id,
	});

	res.redirect('/checkins/places');
});

router.post('/:id', (req: RequestFrontend<object, Place, { id: string }>, res) => {
	const { id } = req.params;
	const { crudType, name, category, address, lat, long, external_id, created_at, updated_at } = req.body;

	switch (crudType) {
		case 'delete': {
			deleteCheckinPlace(Number(id));
			break;
		}

		case 'update': {
			if (!(name && category)) {
				throw new Error('Name and category are required fields');
			}

			updateCheckinPlace({
				id: Number(id),
				name,
				category,
				address,
				lat: lat ? Number(lat) : null,
				long: long ? Number(long) : null,
				external_id,
				created_at,
				updated_at,
			});
		}
	}

	res.redirect('/checkins/places');
});

export default router;
