import express from 'express';
import { NotFoundError } from '@tombofry/stdlib/src/errors/http.js';

import { getListens, getPopular } from '../../database/listens.js';
import { getLikes } from '../../database/youtubelikes.js';
import { getGameActivity, getGameActivityByDay } from '../../database/games.js';
import { getSleepCycles } from '../../database/sleep.js';

import Logger from '../../lib/logger.js';
import { generateBarGraph } from '../../lib/graphs/bar.js';

const log = new Logger('frontend');

const router = express.Router();

// DASHBOARD

router.get('/', (_req, res) => {
	const listens = getListens();
	const youtubelikes = getLikes();
	const gameActivity = getGameActivity();
	const sleep = getSleepCycles();

	const latest = {
		listen: listens[0] || null,
		youtubeLike: youtubelikes[0] || null,
		gameActivity: gameActivity[0] || null,
		sleep: sleep[0] || null,
	};

	res.render(
		'external/dashboard',
		{ latest },
	);
});

// LISTENS

router.get('/listens', (req, res) => {
	const listens = getListens(undefined, req.query.page);
	const popular = getPopular(7);

	res.render(
		'external/listenlist',
		{ listens, popular, page: req.query.page },
	);
});

router.get('/listen/:id', (req, res) => {
	const listens = getListens(req.params.id);

	if (listens.length === 0) {
		throw new NotFoundError('Listen not found');
	}

	res.render(
		'external/listensingle',
		{ listen: listens[0] },
	);
});

// YOUTUBE LIKES

router.get('/youtubelikes', (req, res) => {
	const youtubeLikes = getLikes(undefined, req.query.page);
	res.render(
		'external/youtubelikelist',
		{ youtubeLikes, page: req.query.page },
	);
});

router.get('/youtubelike/:id', (req, res) => {
	const youtubeLikes = getLikes(req.params.id);

	if (youtubeLikes.length === 0) {
		throw new NotFoundError('Like not found');
	}

	res.render(
		'external/youtubelikesingle',
		{ youtubeLike: youtubeLikes[0] },
	);
});

// STEAM ACTIVITY

router.get('/games', (req, res) => {
	const gameActivity = getGameActivity(undefined, req.query.page);
	const gamesByDay = getGameActivityByDay();
	const svg = generateBarGraph(gamesByDay, 'hours');

	res.render(
		'external/gamelist',
		{ gameActivity, page: req.query.page, svg },
	);
});

router.get('/game/:id', (req, res) => {
	const gameActivity = getGameActivity(req.params.id);

	if (gameActivity.length === 0) {
		throw new NotFoundError('Like not found');
	}

	res.render(
		'external/gamesingle',
		{ gameActivity: gameActivity[0] },
	);
});

// SLEEP CYCLES

router.get('/sleeps', (req, res) => {
	const sleep = getSleepCycles(undefined, req.query.page);

	const graphData = sleep.map(night => ({
		y: night.durationNumber,
		label: night.dateShort,
	}));
	const svg = generateBarGraph(graphData, 'hours');

	res.render(
		'external/sleeplist',
		{ sleep, page: req.query.page, svg },
	);
});

router.get('/sleep/:id', (req, res) => {
	const sleep = getSleepCycles(req.params.id);

	if (sleep.length === 0) {
		throw new NotFoundError('Like not found');
	}

	res.render(
		'external/sleepsingle',
		{ sleep: sleep[0] },
	);
});

// NOT FOUND

router.get('*', () => { throw new NotFoundError('Page Not Found'); });

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, _next) => {
	log.error(err.message, err.code, req.originalUrl);
	if (err.code !== 404) {
		log.error(err.stack);
	}

	res
		.status(err.code || 500)
		.render('external/error', { error: err.message });
});

export default router;
