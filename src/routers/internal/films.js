import express from 'express';
import { fetchFilms } from '../../adapters/letterboxd.js';
import { countFilms, deleteFilm, getFilms, insertFilm, updateFilm } from '../../database/films.js';
import { formatDate } from '../../lib/formatDate.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';

const router = express.Router();

// FRONTEND

router.get('/', (req, res) => {
	const { page = 0, rescanerror } = req.query;
	const pagination = handlebarsPagination(page, countFilms());

	const films = getFilms({ page });

	res.render('internal/films', { films, pagination, rescanerror: rescanerror !== undefined });
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
		watched_at,
		created_at,
		process.env.TOMBOIS_DEFAULT_DEVICE_ID,
	);

	res.redirect('/films');
});

router.post('/rescan', async (_req, res) => {
	const fetchFn = fetchFilms();
	if (!fetchFn) {
		return res.redirect('/films?rescanerror');
	}

	try {
		await fetchFn();
		res.redirect('/films');
	} catch (err) {
		res.redirect('/films?rescanerror');
	}
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
				watched_at,
				created_at,
			);
			break;

		default:
			// Do nothing
			break;
	}

	res.redirect('/films');
});

export default router;
