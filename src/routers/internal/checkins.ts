import { Router } from 'express';
import {
	type Checkin,
	getCheckins,
	getPlaceCategories,
	getNearestPlaces,
	insertCheckin,
	insertPlace,
	deleteCheckin,
	updateCheckin,
} from '../../database/checkins.js';
import type { RequestFrontend } from '../../types/express.js';
import { config } from '../../lib/config.js';
import type { Insert } from '../../types/database.js';
import { searchNearbyPlaces } from '../../adapters/googlePlacesApi.js';
import { formatDateTime } from '../../lib/formatDate.js';

const router = Router();

router.get('/', (req: RequestFrontend, res) => {
	const { page } = req.query;
	const checkins = getCheckins({ page }).map(checkin => ({
		...checkin,
		created_at: formatDateTime(new Date(checkin.created_at), true),
		updated_at: formatDateTime(new Date(checkin.updated_at), true),
	}));
	const places = getNearestPlaces().map(place => ({
		value: place.id,
		label: place.name,
	}));
	const categories = getPlaceCategories();

	res.render('internal/checkins', { places, checkins, categories });
});

// Using a POST here, but this is actually a GET request.
// I did not want to include geolocation coordinates in the request URL.
router.post('/places/cached', (req: RequestFrontend, res) => {
	if (Number.isNaN(Number(req.body.lat)) || Number.isNaN(Number(req.body.long))) {
		throw new Error('lat or long is not a valid number');
	}

	const lat = Number(req.body.lat);
	const long = Number(req.body.long);

	const places = getNearestPlaces({ lat, long }).map(place => ({
		value: place.id,
		label: `${place.name} (${place.distance ?? '[??]'} km away)`,
	}));

	res.send({ places });
});

// Another POST request to conceal the lat/long coordinates. This is a separate
// endpoint due to Google's Places API potentially being billed.
router.post('/places/google', async (req: RequestFrontend, res) => {
	if (Number.isNaN(Number(req.body.lat)) || Number.isNaN(Number(req.body.long))) {
		throw new Error('lat or long is not a valid number');
	}

	const lat = Number(req.body.lat);
	const long = Number(req.body.long);

	// Searches and caches results from the Google Places API
	// Does nothing is use of the Places API is turned off.
	await searchNearbyPlaces(lat, long);

	const places = getNearestPlaces({ lat, long }).map(place => ({
		value: place.id,
		label: `${place.name} (${place.distance ?? '[??]'} km away)`,
	}));

	res.send({ places });
});

router.post('/', (req: RequestFrontend, res) => {
	const { place_id, name, category, address, lat, long, description } = req.body;
	const checkin: Insert<Checkin> = {
		place_id: Number(place_id),
		device_id: config.defaultDeviceId,
		created_at: new Date().toISOString(),
		description: description ?? '',
	};

	if (name !== undefined && name !== '') {
		checkin.place_id = insertPlace({
			name,
			category: category || 'other',
			address: address || null,
			lat: Number(lat) || null,
			long: Number(long) || null,
			external_id: null,
		}).id;
	}

	insertCheckin(checkin);

	res.redirect('/checkins');
});

router.post('/:id', (req: RequestFrontend, res) => {
	const { id } = req.params;
	const { crudType, description, created_at, updated_at } = req.body;

	if (id === undefined || description === undefined || created_at === undefined || updated_at === undefined) {
		res.redirect('/checkins');
		return;
	}

	switch (crudType) {
		case 'delete': {
			deleteCheckin(id);
			break;
		}

		case 'update': {
			updateCheckin({
				id,
				description,
				created_at,
				updated_at,
			});
			break;
		}

		default:
			// Do nothing
			break;
	}

	res.redirect('/checkins');
});

export default router;
