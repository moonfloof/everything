import { Router } from 'express';
import { searchNearbyPlaces } from '../../adapters/googlePlacesApi.js';
import { convertImageToDatabase } from '../../adapters/swarm.js';
import { getNearestPlaces, getPlaceCategories, insertPlace } from '../../database/checkinPlace.js';
import {
	type Checkin,
	countCheckins,
	deleteCheckin,
	getCheckins,
	insertCheckin,
	updateCheckin,
} from '../../database/checkins.js';
import { type EntryStatus, entryStatusValues } from '../../database/notes.js';
import { config } from '../../lib/config.js';
import Logger from '../../lib/logger.js';
import type { Insert } from '../../types/database.js';
import type { RequestFrontend } from '../../types/express.js';
import checkinPlaces from './checkinPlaces.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';

const log = new Logger('checkin');

const router = Router();

router.use('/places', checkinPlaces);

router.get('/', (req: RequestFrontend, res) => {
	const { page } = req.query;
	const pagination = handlebarsPagination(page, countCheckins());
	const checkins = getCheckins({ page, status: '%' });
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
		pagination,
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

interface InternalInsertCheckin {
	place_id: string;
	name: string;
	category: string;
	address: string;
	lat: string;
	long: string;
	description: string;
	status: string;
	created_at: string;
	photos?: string[];
}

router.post('/', async (req: RequestFrontend<object, InternalInsertCheckin>, res) => {
	const { place_id, name, category, address, lat, long, description, status, created_at, photos } = req.body;
	const checkinToInsert: Insert<Checkin> = {
		place_id: Number(place_id),
		device_id: config.defaultDeviceId,
		created_at,
		description,
		status: (status as EntryStatus | undefined) || 'public',
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

	const checkin = insertCheckin(checkinToInsert);

	if (photos === undefined) {
		res.redirect('/checkins');
		return;
	}

	let counter = 0;
	for (const photo of photos) {
		if (!photo.startsWith('data:image/jpeg;base64,')) {
			log.info("Tried to save an image, but it didn't start with 'data:image/jpeg;base64,'");
			continue;
		}

		log.info(`Converting photo ${++counter} of ${photos.length} for checkin '${checkin.id}'`);
		const buffer = Buffer.from(photo.slice(23), 'base64');
		await convertImageToDatabase(checkin.id, buffer);
	}

	res.redirect('/checkins');
});

interface InternalCheckinUpdate {
	crudType?: 'update' | 'delete';
	description: string;
	status: string;
	created_at: string;
	updated_at: string;
}

router.post('/:id', (req: RequestFrontend<object, InternalCheckinUpdate, { id: string }>, res) => {
	const { id } = req.params;
	const { crudType, description, status, created_at, updated_at } = req.body;

	switch (crudType) {
		case 'delete': {
			deleteCheckin(id);
			break;
		}

		case 'update': {
			updateCheckin({
				id,
				description,
				status: (status || 'public') as EntryStatus,
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
