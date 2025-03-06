import { Router } from 'express';
import { searchNearbyPlaces } from '../../adapters/googlePlacesApi.js';
import {
	type Checkin,
	deleteCheckin,
	getCheckins,
	getNearestPlaces,
	getPlaceCategories,
	insertCheckin,
	insertPlace,
	updateCheckin,
} from '../../database/checkins.js';
import { type EntryStatus, entryStatusValues } from '../../database/notes.js';
import { config } from '../../lib/config.js';
import type { Insert } from '../../types/database.js';
import type { RequestFrontend } from '../../types/express.js';

const router = Router();

router.get('/', (req: RequestFrontend, res) => {
	const { page } = req.query;
	const checkins = getCheckins({ page });
	const places = getNearestPlaces().map(place => ({
		value: place.id,
		label: place.name,
	}));
	const categories = getPlaceCategories();

	res.render('internal/checkins', {
		places,
		checkins,
		categories,
		entryStatusValues,
	});
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
	const { place_id, name, category, address, lat, long, description, status } = req.body;
	const checkinToInsert: Insert<Checkin> = {
		place_id: Number(place_id),
		device_id: config.defaultDeviceId,
		created_at: new Date().toISOString(),
		description: description ?? '',
		status: (status as EntryStatus | undefined) ?? 'public',
	};

	if (name !== undefined && name !== '') {
		checkinToInsert.place_id = insertPlace({
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
