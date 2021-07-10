import express from 'express';
import { countListens, deleteListen, getListens, insertScrobble, updateListen } from '../../database/listens.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';

const router = express.Router();

// FRONTEND

router.get('/', (req, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countListens());

	const listens = getListens({ page });

	res.render('internal/listens', { listens, pagination });
});

// CRUD

router.post('/', (req, res) => {
	const { artist, album, title, tracknumber, release_year, genre, created_at } = req.body;

	insertScrobble(
		artist,
		album,
		title,
		tracknumber,
		release_year,
		genre,
		created_at || new Date().toISOString(),
		process.env.TOMBOIS_DEFAULT_DEVICE_ID,
	);

	res.redirect('/listens');
});

router.post('/:id', (req, res) => {
	const { id } = req.params;
	const { crudType, artist, album, title, tracknumber, release_year, genre, created_at } = req.body;

	switch (crudType) {
		case 'delete':
			deleteListen(id);
			break;

		case 'update':
			updateListen(id, artist, album, title, tracknumber, release_year, genre, created_at);
			break;

		default:
			// Do nothing
			break;
	}

	res.redirect('/listens');
});

export default router;
