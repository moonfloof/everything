import express from 'express';
import { countListens, deleteListen, getListens, insertScrobble, updateListen } from '../../database/listens.js';
import { config } from '../../lib/config.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import type { RequestFrontend } from '../../types/express.js';

const router = express.Router();

// FRONTEND

router.get('/', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countListens());

	const listens = getListens({ page });

	res.render('internal/listens', { listens, pagination });
});

// CRUD

router.post('/', (req: RequestFrontend, res) => {
	const { artist, album, title, tracknumber, release_year, genre, created_at } = req.body;

	insertScrobble({
		artist,
		album,
		title,
		tracknumber: Number(tracknumber) || null,
		release_year: Number(release_year) || null,
		genre,
		created_at,
		device_id: config.defaultDeviceId,
	});

	res.redirect('/listens');
});

router.post('/:id', (req: RequestFrontend, res) => {
	const { id } = req.params;
	const { crudType, artist, album, title, tracknumber, release_year, genre, created_at } = req.body;

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
				tracknumber: Number(tracknumber) || null,
				release_year: Number(release_year) || null,
				genre,
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
