import express from 'express';
import { getAlbumTracks, getAllAlbums, scrobbleTrack } from '../../adapters/subsonic.js';
import Logger from '../../lib/logger.js';
import type { RequestFrontend } from '../../types/express.js';

const log = new Logger('ListenBrainz');

const router = express.Router();

router.get('/', async (_req, res) => {
	try {
		// Step 1: Get all artists / albums from subsonic
		const albumlistRaw = await getAllAlbums();

		albumlistRaw.sort((a, b) => {
			const al = `${a.artist}${a.name}`.toLowerCase();
			const bl = `${b.artist}${b.name}`.toLowerCase();
			if (al < bl) {
				return -1;
			}
			if (al > bl) {
				return 1;
			}
			return 0;
		});

		// Step 2: Add them to formatted list
		const albumlist = albumlistRaw.map(album => ({
			value: album.id,
			label: `${album.artist} - ${album.name} [${album.year}]`,
		}));

		// Step 3: Send to server
		res.render('internal/scrobble', { albumlist });
	} catch (err) {
		log.error(err);
		res.redirect('/');
	}
});

router.post('/', async (req: RequestFrontend<object, { albumId: string; dateTime: string }>, res) => {
	try {
		// Step 1: Get tracks from album
		const album = await getAlbumTracks(req.body.albumId);

		if (album === null) {
			throw new Error('Could not load album');
		}

		let now = new Date(req.body.dateTime || Date.now()).getTime();

		// Step 2: Scrobble each track using duration and current time
		album.song.reverse();
		for (const song of album.song) {
			now -= song.duration * 1000;
			await scrobbleTrack(song.id, now);
		}
	} catch (err) {
		log.error(err);
	}

	// Step 3: Redirect to listens page
	res.redirect('/listens');
});

export default router;
