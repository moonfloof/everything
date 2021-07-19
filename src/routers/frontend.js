import express from 'express';
import { getListens, getPopular } from '../database/listens.js';
import { getLikes } from '../database/youtubelikes.js';
import { NotFoundError } from '@tombofry/stdlib/src/errors/http.js';
import { getGameActivity } from '../database/games.js';
import Logger from '../lib/logger.js';

const log = new Logger('frontend');

const router = express.Router();

// DASHBOARD

router.get('/', (_req, res) => {
	const listens = getListens();
	const youtubelikes = getLikes();
	const gameActivity = getGameActivity();

	const latest = {
		listen: listens[0] || null,
		youtubeLike: youtubelikes[0] || null,
		gameActivity: gameActivity[0] || null,
	};

	res.render('dashboard', { latest });
});

// LISTENS

router.get('/listens', (req, res) => {
	const listens = getListens(undefined, req.query.page);
	const popular = getPopular(7);

	res.render('listenlist', {
		listens,
		popular,
		page: req.query.page,
	});
});

router.get('/listen/:id', (req, res) => {
	const listens = getListens(req.params.id);

	if (listens.length === 0) {
		throw new NotFoundError('Listen not found');
	}

	res.render('listensingle', { listen: listens[0] });
});

// YOUTUBE LIKES

router.get('/youtubelikes', (req, res) => {
	const youtubeLikes = getLikes(undefined, req.query.page);
	res.render('youtubelikelist', { youtubeLikes, page: req.query.page });
});

router.get('/youtubelike/:id', (req, res) => {
	const youtubeLikes = getLikes(req.params.id);

	if (youtubeLikes.length === 0) {
		throw new NotFoundError('Like not found');
	}

	res.render('youtubelikesingle', { youtubeLike: youtubeLikes[0] });
});

// STEAM ACTIVITY

router.get('/games', (req, res) => {
	const gameActivity = getGameActivity(undefined, req.query.page);
	res.render('gamelist', { gameActivity, page: req.query.page });
});

router.get('/game/:id', (req, res) => {
	const gameActivity = getGameActivity(req.params.id);

	if (gameActivity.length === 0) {
		throw new NotFoundError('Like not found');
	}

	res.render('gamesingle', { gameActivity: gameActivity[0] });
});

router.get('*', () => { throw new NotFoundError('Page Not Found'); });

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, _next) => {
	log.error(err.message, err.code, req.originalUrl);
	if (err.code !== 404) {
		log.error(err.stack);
	}

	res
		.status(err.code || 500)
		.render('error', { error: err.message });
});

export default router;
