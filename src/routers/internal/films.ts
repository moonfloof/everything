import express from 'express';
import { fetchFilms } from '../../adapters/letterboxd.js';
import { searchForImagesByName } from '../../adapters/tmdb.js';
import { countFilms, deleteFilm, getFilms, insertFilm, updateFilm } from '../../database/films.js';
import { config } from '../../lib/config.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import { deleteIfExists } from '../../lib/mediaFiles.js';
import type { RequestFrontend } from '../../types/express.js';

const router = express.Router();

// FRONTEND

router.get('/', (req: RequestFrontend, res) => {
	const { page = 0, rescanerror } = req.query;
	const pagination = handlebarsPagination(page, countFilms());
	const hasLetterboxdConnected = config.letterboxd.username !== '' && config.letterboxd.username !== undefined;

	const films = getFilms({ page });

	res.render('internal/films', {
		films,
		page,
		pagination,
		hasLetterboxdConnected,
		rescanerror: rescanerror !== undefined,
	});
});

// CRUD

interface Film {
	crudType?: 'update' | 'delete';
	title: string;
	year: string;
	rating: string;
	review: string;
	url: string;
	duration_secs: string;
	watched_at: string;
	created_at: string;
}

router.post('/', (req: RequestFrontend<object, Film>, res) => {
	const { title, year, rating, review, url, duration_secs, watched_at, created_at } = req.body;

	insertFilm({
		title,
		year: Number(year || 0),
		rating: Number(rating) || null,
		review: review || null,
		url: url || null,
		duration_secs: duration_secs?.trim() ? Number(duration_secs) : null,
		watched_at,
		created_at,
		device_id: config.defaultDeviceId,
	});

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
	} catch (_err) {
		res.redirect('/films?rescanerror');
	}
});

router.post('/:id', (req: RequestFrontend<object, Film, { id: string }>, res) => {
	const { id } = req.params;
	const { crudType, title, year, rating, review, url, duration_secs, watched_at, created_at } = req.body;

	switch (crudType) {
		case 'delete': {
			deleteFilm(id);
			deleteIfExists('film', `hero-${id}`);
			deleteIfExists('film', `poster-${id}`);
			break;
		}

		case 'update': {
			updateFilm({
				id,
				title,
				year: Number(year || 0),
				rating: Number(rating) || null,
				review: review || null,
				url: url || null,
				duration_secs: duration_secs?.trim() ? Number(duration_secs) : null,
				watched_at,
				created_at,
			});
			break;
		}

		default:
			// Do nothing
			break;
	}

	res.redirect('/films');
});

router.get('/update-images/:id', async (req: RequestFrontend, res) => {
	const { id } = req.params;
	const film = getFilms({ id, limit: 1 })?.[0];

	const redirect = (): void => {
		const page = req.query.page;
		let url = '/films';
		if (page) url += `?page=${page}`;
		if (film) url += `#film-${film.id}`;
		res.redirect(url);
	};

	if (!film) return redirect();

	await searchForImagesByName(film.id, film.title, film.year);

	redirect();
});

export default router;
