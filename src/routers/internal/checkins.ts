import { Router } from 'express';
import { searchNearbyPlaces } from '../../adapters/googlePlacesApi.js';
import { convertImageToDatabase } from '../../adapters/swarm.js';
import {
	type CheckinPlace,
	getCheckinPlaceById,
	getNearestPlaces,
	getPlaceCategories,
	insertPlace,
} from '../../database/checkinPlace.js';
import {
	type Checkin,
	countCheckins,
	deleteCheckin,
	deleteCheckinImage,
	getCheckins,
	insertCheckin,
	updateCheckin,
} from '../../database/checkins.js';
import { type EntryStatus, entryStatusValues } from '../../database/notes.js';
import { config } from '../../lib/config.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import Logger from '../../lib/logger.js';
import { queue } from '../../lib/queue.js';
import type { Insert } from '../../types/database.js';
import type { RequestFrontend } from '../../types/express.js';
import checkinPlaces from './checkinPlaces.js';

const log = new Logger('checkin');

const router = Router();

router.use('/places', checkinPlaces);

router.get('/', (req: RequestFrontend, res) => {
	const { page } = req.query;
	const pagination = handlebarsPagination(page, countCheckins());
	const checkins = getCheckins({ page, status: '%', includeImages: true });
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
		page,
		pagination,
	});
});

// Using a POST here, but this is actually a GET request.
// I did not want to include geolocation coordinates in the request URL.
router.post('/get-places/cached', (req: RequestFrontend, res) => {
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
router.post('/get-places/google', async (req: RequestFrontend, res) => {
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

function savePhoto(checkin_id: string, photo: string, index: number, total: number) {
	const task = async () => {
		if (!photo.startsWith('data:image/jpeg;base64,')) {
			log.info("Tried to save an image, but it didn't start with 'data:image/jpeg;base64,'");
			return;
		}

		log.info(`Converting photo ${index} of ${total} for checkin '${checkin_id}'`);
		const buffer = Buffer.from(photo.slice(23), 'base64');
		await convertImageToDatabase(checkin_id, buffer);
	};

	queue.addToQueue(task);
}

router.post('/', (req: RequestFrontend<object, InternalInsertCheckin>, res) => {
	const { place_id, name, category, address, lat, long, description, status, created_at, photos } = req.body;
	const checkinToInsert: Insert<Checkin> = {
		place_id: Number(place_id),
		device_id: config.defaultDeviceId,
		created_at,
		description,
		status: (status as EntryStatus | undefined) || 'public',
	};

	let place: CheckinPlace | null = null;

	if (name !== undefined && name !== '') {
		place = insertPlace({
			name,
			category: category || 'Other',
			address: address || null,
			lat: Number(lat) || null,
			long: Number(long) || null,
			external_id: null,
		});
		checkinToInsert.place_id = place.id;
	} else {
		place = getCheckinPlaceById(Number(place_id)) ?? null;
	}

	const latNumber = place?.lat ?? Number(lat);
	const longNumber = place?.long ?? Number(long);

	const checkin = insertCheckin(checkinToInsert, latNumber, longNumber);

	if (photos === undefined) {
		res.redirect('/checkins');
		return;
	}

	let counter = 0;
	for (const photo of photos) {
		savePhoto(checkin.id, photo, ++counter, photos.length);
	}

	res.redirect('/checkins');
});

interface InternalCheckinUpdate {
	crudType?: 'update' | 'delete';
	description: string;
	status: string;
	created_at: string;
	updated_at: string;
	photos?: string[];
}

router.post('/:id', (req: RequestFrontend<object, InternalCheckinUpdate, { id: string }>, res) => {
	const { id } = req.params;
	const { crudType, description, status, created_at, updated_at, photos } = req.body;

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

			if (photos === undefined) break;

			let counter = 0;
			for (const photo of photos) {
				savePhoto(id, photo, ++counter, photos.length);
			}
			break;
		}

		default:
			// Do nothing
			break;
	}

	res.redirect('/checkins');
});

// Photo manipulation

router.get('/photos/:id', (req: RequestFrontend<object, object, { id: string }>, res) => {
	const { page = 0 } = req.query;
	const { id } = req.params;

	deleteCheckinImage(Number(id));

	res.redirect(`/checkins?page=${page}`);
});

export default router;
