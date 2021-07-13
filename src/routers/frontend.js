import Router from 'express-promise-router';
import { getListens } from '../database/listens.js';
import { getLikes } from '../database/youtubelikes.js';

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

router.get('*', () => { throw new Error('Page Not Found'); });

// eslint-disable-next-line no-unused-vars
router.use((err, _req, res, next) => {
	console.log(err);
	res.render('error', { error: err.message });
});

export default router;
