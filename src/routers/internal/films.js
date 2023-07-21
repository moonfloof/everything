import express from 'express';
import { countFilms, deleteFilm, getFilms, insertFilm, updateFilm } from '../../database/films.js';
import { formatDate } from '../../lib/formatDate.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';

const router = express.Router();

// FRONTEND

router.get('/', (req, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countFilms());

	const films = getFilms({ page });

	res.render('internal/films', { films, pagination });
});

// CRUD

router.post('/', (req, res) => {
	const { title, year, rating, review, url, watched_at, created_at } = req.body;

	insertFilm(
		title,
		Number(year),
		rating ? Number(rating) : null,
		review,
		url,
		watched_at || formatDate(new Date()),
		created_at || new Date().toISOString(),
		process.env.TOMBOIS_DEFAULT_DEVICE_ID,
	);

	res.redirect('/films');
});

router.post('/:id', (req, res) => {
	const { id } = req.params;
	const { crudType, title, year, rating, review, url, watched_at, created_at } = req.body;

	switch (crudType) {
		case 'delete':
			deleteFilm(id);
			break;

		case 'update':
			updateFilm(
				id,
				title,
				Number(year),
				rating ? Number(rating) : null,
				review || null,
				url,
				watched_at || formatDate(new Date()),
				created_at || new Date().toISOString(),
			);
			break;

		default:
			// Do nothing
			break;
	}

	res.redirect('/films');
});

export default router;
