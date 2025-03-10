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

interface Listen {
	crudType?: 'update' | 'delete';
	artist: string;
	album: string;
	title: string;
	track_number: string;
	release_year: string;
	genre: string;
	duration_secs: string;
	created_at: string;
}

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

router.post('/', (req: RequestFrontend<object, Listen>, res) => {
	const { artist, album, title, track_number, release_year, genre, duration_secs, created_at } = req.body;

	insertScrobble({
		artist,
		album,
		title,
		track_number: Number(track_number) || null,
		release_year: Number(release_year) || null,
		genre: genre || null,
		duration_secs: Number(duration_secs) || null,
		created_at,
		device_id: config.defaultDeviceId,
	});

	res.redirect('/listens');
});

router.post('/:id', (req: RequestFrontend<object, Listen, { id: string }>, res) => {
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
				genre: genre || null,
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
