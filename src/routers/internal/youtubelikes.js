import express from 'express';
import { countYouTubeLikes, getLikes, deleteYouTubeLike, updateYouTubeLike } from '../../database/youtubelikes.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';

const router = express.Router();

// FRONTEND

router.get('/', (req, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countYouTubeLikes());

	const youtubelikes = getLikes(undefined, page);

	res.render('internal/youtubelikes', { youtubelikes, pagination });
});

// CRUD

router.post('/:id', (req, res) => {
	const { id } = req.params;
	const { crudType, url, title, channel, created_at } = req.body;

	switch (crudType) {
		case 'delete':
			deleteYouTubeLike(id);
			break;

		case 'update':
			updateYouTubeLike(id, url, title, channel, created_at);
			break;

		default:
			// Do nothing
			break;
	}

	res.redirect('/youtubelikes');
});

export default router;
