import express from 'express';
import { searchTrack } from '../../adapters/subsonic.js';
import {
	countListens,
	deleteListen,
	getListens,
	getTracksWithMissingMetadata,
	insertScrobble,
	updateListen,
	updateListenTrack,
} from '../../database/listens.js';
import { config } from '../../lib/config.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import type { RequestFrontend } from '../../types/express.js';

const router = express.Router();

// FRONTEND

router.get('/', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countListens());
	const hasSubsonicConnected = config.subsonic.url !== '' && config.subsonic.url !== undefined;

	const listens = getListens({ page });

	res.render('internal/listens', { listens, pagination, hasSubsonicConnected });
});

// CRUD

router.post('/update_metadata', async (_req, res) => {
	const tracks = getTracksWithMissingMetadata();
	for (const track of tracks) {
		try {
			const search = await searchTrack(track.title, track.album, track.artist);
			if (!search) continue;

			const newTrack = { ...track, track_id: track.id, id: '', created_at: '' };
			if (!newTrack.genre) newTrack.genre = search.genre;
			if (!newTrack.duration_secs) newTrack.duration_secs = search.duration;
			if (!newTrack.release_year) newTrack.release_year = search.year;
			if (!newTrack.track_number) newTrack.track_number = search.track;
			updateListenTrack(newTrack);
		} catch (err) {
			console.error(err);
		}
	}

	res.redirect('/listens');
});

router.post('/', (req: RequestFrontend, res) => {
	const { artist, album, title, track_number, release_year, genre, duration_secs, created_at } = req.body;

	insertScrobble({
		artist,
		album,
		title,
		track_number: Number(track_number) || null,
		release_year: Number(release_year) || null,
		genre,
		duration_secs: Number(duration_secs) || null,
		created_at,
		device_id: config.defaultDeviceId,
	});

	res.redirect('/listens');
});

router.post('/:id', (req: RequestFrontend, res) => {
	const { id } = req.params;
	const { crudType, artist, album, title, track_number, release_year, genre, duration_secs, created_at } =
		req.body;

	switch (crudType) {
		case 'delete': {
			deleteListen(id);
			break;
		}

		case 'update': {
			updateListen({
				id,
				artist,
				album,
				title,
				track_number: Number(track_number) || null,
				release_year: Number(release_year) || null,
				genre,
				duration_secs: Number(duration_secs) || null,
				created_at,
			});
			break;
		}

		default:
			// Do nothing
			break;
	}

	res.redirect('/listens');
});

export default router;
