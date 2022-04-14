import express from 'express';
import { NotFoundError } from '@tombofry/stdlib/src/errors/http.js';

import {
	countListens,
	getListenDashboardGraph,
	getListenGraph,
	getListenPopularDashboard,
	getListens,
	getListensPopular,
} from '../../database/listens.js';
import { countYouTubeLikes, getLikes } from '../../database/youtubelikes.js';
import { countGameActivity, getGameActivity, getGameActivityByDay, getGameDashboardGraph } from '../../database/games.js';
import { getSleepCycles, getSleepStats } from '../../database/sleep.js';
import { getStepsYesterday } from '../../database/steps.js';
import { getDevices } from '../../database/devices.js';

import Logger from '../../lib/logger.js';
import { generateBarGraph } from '../../lib/graphs/bar.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import { getLatestCity } from '../../database/locations.js';
import { generateSmallBarGraph } from '../../lib/graphs/barSmall.js';

const log = new Logger('frontend');

const router = express.Router();

// DASHBOARD

router.get('/', (_req, res) => {
	const listens = getListenPopularDashboard(7);
	const youtubeLikes = getLikes().slice(0, 2);
	const games = getGameActivity();
	const device = getDevices()[0];
	const location = getLatestCity();
	const steps = getStepsYesterday()[0]?.step_count_total;
	const sleepStats = getSleepStats();
	const sleep = getSleepCycles();

	const sleepGraphStats = sleep
		.filter(night => night.ended_at !== null)
		.map(night => ({
			min: night.startTimeNormalised,
			max: night.startTimeNormalised + night.durationNumber,
		}));

	const sleepGraph = generateSmallBarGraph(sleepGraphStats);
	const listenGraph = generateSmallBarGraph(getListenDashboardGraph());
	const gamesGraph = generateSmallBarGraph(getGameDashboardGraph());

	res.render('external/dashboard', {
		sleepStats,
		sleepGraph,
		listens,
		listenGraph,
		youtubeLikes,
		games,
		gamesGraph,
		device,
		steps,
		location,
	});
});

// LISTENS

router.get('/music', (req, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countListens());

	const listens = getListens(undefined, page);
	const popular = getListensPopular(7);
	const graphPoints = getListenGraph();
	const svg = generateBarGraph(graphPoints, 'scrobbles');

	res.render(
		'external/listenlist',
		{ listens, popular, pagination, svg },
	);
});

router.get('/music/:id', (req, res) => {
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

router.get('/youtube', (req, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countYouTubeLikes());

	const youtubeLikes = getLikes(undefined, page);

	res.render(
		'external/youtubelikelist',
		{ youtubeLikes, pagination },
	);
});

router.get('/youtube/:id', (req, res) => {
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
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countGameActivity());

	const gameActivity = getGameActivity(undefined, page);
	const gamesByDay = getGameActivityByDay();
	const svg = generateBarGraph(gamesByDay, 'hours');

	res.render(
		'external/gamelist',
		{ gameActivity, svg, pagination },
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
