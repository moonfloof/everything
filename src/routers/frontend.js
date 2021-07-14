import Router from 'express-promise-router';
import { getListens } from '../database/listens.js';
import { getLikes } from '../database/youtubelikes.js';
import { NotFoundError } from '@tombofry/stdlib/src/errors/http.js';

const router = Router();

// DASHBOARD

router.get('/', async (_req, res) => {
	const [ listens, youtubelikes ] = await Promise.all([
		getListens(),
		getLikes(),
	]);

	const latest = {
		listen: listens[0] || null,
		youtubeLike: youtubelikes[0] || null,
	};

	res.render('dashboard', { latest });
});

// LISTENS

router.get('/listens', async (req, res) => {
	const listens = await getListens(undefined, req.query.page);
	res.render('listenlist', { listens, page: req.query.page });
});

router.get('/listen/:id', async (req, res) => {
	const listens = await getListens(req.params.id);

	if (listens.length === 0) {
		throw new NotFoundError('Listen not found');
	}

	res.render('listensingle', { listen: listens[0] });
});

// YOUTUBE LIKES

router.get('/youtubelikes', async (req, res) => {
	const youtubeLikes = await getLikes(undefined, req.query.page);
	res.render('youtubelikelist', { youtubeLikes, page: req.query.page });
});

router.get('/youtubelike/:id', async (req, res) => {
	const youtubeLikes = await getLikes(req.params.id);

	if (youtubeLikes.length === 0) {
		throw new NotFoundError('Like not found');
	}

	res.render('youtubelikesingle', { youtubeLike: youtubeLikes[0] });
});

router.get('*', () => { throw new NotFoundError('Page Not Found'); });

// eslint-disable-next-line no-unused-vars
router.use((err, _req, res, _next) => {
	console.error(err);
	res
		.status(err.code || 500)
		.render('error', { error: err.message });
});

export default router;
