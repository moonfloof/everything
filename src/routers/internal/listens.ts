import express from 'express';
import {
	type ListenAlbum,
	type ListenArtist,
	countAlbums,
	countArtists,
	countListens,
	countTracks,
	deleteAlbum,
	deleteArtist,
	deleteTrack,
	getAlbums,
	getArtists,
	getListens,
	getTracks,
	getTracksWithMissingMetadata,
	insertListenRaw,
	updateAlbum,
	updateArtist,
	updateTrack,
	upsertAlbum,
	upsertArtist,
	upsertTrack,
} from '../../database/listens.js';
import { config } from '../../lib/config.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import { validateSafeNumber } from '../../lib/validation.js';
import type { RequestFrontend } from '../../types/express.js';
import { searchTrack } from '../../adapters/subsonic.js';

const router = express.Router();

// FRONTEND

router.get('/', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countListens());
	const hasSubsonicConnected = config.subsonic.url !== '' && config.subsonic.url !== undefined;

	const listens = getListens({ page });

	res.render('internal/listens', { listens, pagination, hasSubsonicConnected });
});

router.get('/artists', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countArtists());
	const artists = getArtists({ page });
	res.render('internal/listens-artists', { artists, pagination });
});

router.get('/albums', (req: RequestFrontend<{ artist_id?: string }>, res) => {
	const { page = 0, artist_id } = req.query;

	const pagination = handlebarsPagination(page, countAlbums(artist_id));
	let artist: ListenArtist | null = null;

	if (artist_id) {
		[artist] = getArtists({ id: artist_id, limit: 1 });
	}

	const albums = getAlbums({ page }, artist_id);
	res.render('internal/listens-albums', { artist, albums, pagination });
});

router.get('/tracks', (req: RequestFrontend<{ album_id?: string }>, res) => {
	const { page = 0, album_id } = req.query;

	const pagination = handlebarsPagination(page, countTracks(album_id));
	let album: ListenAlbum | null = null;

	if (album_id) {
		[album] = getAlbums({ id: album_id, limit: 1 });
	}

	const tracks = getTracks({ page }, album_id);
	res.render('internal/listens-tracks', { album, tracks, pagination });
});

// CRUD

// TODO: Finish POST /listens and POST /listens/:id
// TODO: Redesign listens page to use select fields for artist/album/track

router.post('/', (req: RequestFrontend, res) => {
	const { track_id, created_at } = req.body;
	const newListen = insertListenRaw({ created_at }, track_id);
	// const
	res.redirect('');
});

router.post('/artist', (req: RequestFrontend, res) => {
	const { artist } = req.body;
	const newArtist = upsertArtist({ artist });
	res.redirect(`/listens/albums/?artist_id=${newArtist.id}`);
});

router.post('/artist/:artist_id', (req: RequestFrontend, res) => {
	const { artist_id } = req.params;
	const { crudType, artist } = req.body;

	switch (crudType) {
		case 'delete': {
			deleteArtist(artist_id);
			break;
		}
		case 'update': {
			updateArtist(artist_id, { artist });
			break;
		}
	}

	res.redirect('/listens/artists');
});

router.post('/album', (req: RequestFrontend, res) => {
	const { album, genre, artist_id } = req.body;
	const release_year = validateSafeNumber(req.body.release_year);
	const newAlbum = upsertAlbum({ album, release_year, genre }, artist_id);
	res.redirect(`/listens/tracks/?album_id=${newAlbum.id}`);
});

router.post('/album/:album_id', (req: RequestFrontend, res) => {
	const { album_id } = req.params;
	const { crudType, album, genre, artist_id } = req.body;

	const release_year = validateSafeNumber(req.body.release_year);

	switch (crudType) {
		case 'delete': {
			deleteAlbum(album_id);
			break;
		}
		case 'update': {
			updateAlbum(album_id, { album, release_year, genre });
			break;
		}
	}

	let redirect_url = '/listens/albums';
	if (artist_id !== '') {
		redirect_url += `?artist_id=${artist_id}`;
	}

	res.redirect(redirect_url);
});

router.post('/track', (req: RequestFrontend, res) => {
	const { title, album_id } = req.body;
	const track_number = validateSafeNumber(req.body.track_number);
	const duration_secs = validateSafeNumber(req.body.duration_secs);
	upsertTrack({ title, track_number, duration_secs }, album_id);
	res.redirect(`/listens/tracks/?album_id=${album_id}`);
});

router.post('/track/:track_id', (req: RequestFrontend, res) => {
	const { track_id } = req.params;
	const { crudType, title, album_id } = req.body;

	const track_number = validateSafeNumber(req.body.track_number);
	const duration_secs = validateSafeNumber(req.body.duration_secs);

	switch (crudType) {
		case 'delete': {
			deleteTrack(track_id);
			break;
		}
		case 'update': {
			updateTrack(track_id, { title, duration_secs, track_number });
			break;
		}
	}

	let redirect_url = '/listens/tracks';
	if (album_id !== '') {
		redirect_url += `?album_id=${album_id}`;
	}

	res.redirect(redirect_url);
});

router.get('/tracks/update-metadata', async (_req, res) => {
	const tracks = getTracksWithMissingMetadata();
	for (const track of tracks) {
		try {
			const search = await searchTrack(track.title, track.album, track.artist);
			if (!search) continue;

			const newTrack = { ...track, track_id: track.id, id: '', created_at: '' };
			// if (!newTrack.genre) newTrack.genre = search.genre;
			if (!newTrack.duration_secs) newTrack.duration_secs = search.duration;
			// if (!newTrack.release_year) newTrack.release_year = search.year;
			if (!newTrack.track_number) newTrack.track_number = search.track;
			// updateListenTrack(newTrack);
		} catch (err) {
			console.error(err);
		}
	}

	res.redirect('/listens');
});

export default router;
