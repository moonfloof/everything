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
import {
	countGameActivity,
	getGameActivity,
	getGameActivityGroupedByDay,
	getGameDashboardGraph,
	getGameStats,
} from '../../database/games.js';
import { countYouTubeLikes, getLikes } from '../../database/youtubelikes.js';
import { getSleepCycles, getSleepStats } from '../../database/sleep.js';
import { getStepsYesterday } from '../../database/steps.js';
import { getDevices } from '../../database/devices.js';

import Logger from '../../lib/logger.js';
import { generateBarGraph } from '../../lib/graphs/bar.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import { getLatestCity } from '../../database/locations.js';
import { generateSmallBarGraph } from '../../lib/graphs/barSmall.js';
import { getCanonicalUrl } from '../../lib/getCanonicalUrl.js';
import getCache from '../../lib/middleware/cachePage.js';
import addMissingDates from '../../lib/addMissingDates.js';
import { shortDate } from '../../lib/formatDate.js';
import { countEpisodes, getEpisodes } from '../../database/tv.js';
import { countFilms, getFilms } from '../../database/films.js';

const log = new Logger('frontend');

const router = express.Router();

// DASHBOARD

router.get('/', getCache(), (req, res) => {
	const listens = getListenPopularDashboard(7);
	const youtubeLikes = getLikes().slice(0, 2);
	const tvEpisodes = getEpisodes().slice(0, 2);
	const films = getFilms().slice(0, 2);
	const gameStats = getGameStats();
	const games = getGameActivity();
	const device = getDevices()[0];
	const location = getLatestCity();
	const steps = getStepsYesterday()[0]?.step_count_total;
	const sleepStats = getSleepStats();
	const sleep = getSleepCycles();

	const sleepGraphStats = sleep
		.filter(night => night.ended_at !== null)
		.map(night => ({
			created_at: night.ended_at,
			min: night.startTimeNormalised,
			max: night.startTimeNormalised + night.durationNumber,
		}));

	const sleepGraph = generateSmallBarGraph(addMissingDates(sleepGraphStats));
	const listenGraph = generateSmallBarGraph(addMissingDates(getListenDashboardGraph(), 'day'));
	const gamesGraph = generateSmallBarGraph(addMissingDates(getGameDashboardGraph(), 'day'));

	res.render('external/dashboard', {
		sleepStats,
		sleepGraph,
		listens,
		listenGraph,
		youtubeLikes,
		tvEpisodes,
		films,
		games,
		gamesGraph,
		gameStats,
		device,
		steps,
		location,
		canonicalUrl: getCanonicalUrl(req),
	});
});

// LISTENS

router.get('/music', getCache(), (req, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countListens());

	const listens = getListens(undefined, page);
	const popular = getListensPopular(7);
	const graphPoints = getListenGraph();
	const svg = generateBarGraph(addMissingDates(
		graphPoints,
		'day',
		(date) => ({ y: 0, label: shortDate(date) }),
	), 'scrobbles');

	res.render('external/listen-list', {
		listens,
		popular,
		pagination,
		svg,
		canonicalUrl: getCanonicalUrl(req),
	});
});

router.get('/music/:id', (req, res) => {
	const listens = getListens(req.params.id);

	if (listens.length === 0) {
		throw new NotFoundError('Listen not found');
	}

	res.render('external/listen-single', {
		listen: listens[0],
		canonicalUrl: getCanonicalUrl(req),
	});
});

// YOUTUBE LIKES

router.get('/youtube', getCache(), (req, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countYouTubeLikes());

	const youtubeLikes = getLikes(undefined, page);

	res.render('external/youtubelike-list', {
		youtubeLikes,
		pagination,
		canonicalUrl: getCanonicalUrl(req),
	});
});

router.get('/youtube/:id', (req, res) => {
	const youtubeLikes = getLikes(req.params.id);

	if (youtubeLikes.length === 0) {
		throw new NotFoundError('Like not found');
	}

	res.render('external/youtubelike-single', {
		youtubeLike: youtubeLikes[0],
		canonicalUrl: getCanonicalUrl(req),
	});
});

// STEAM ACTIVITY

router.get('/games', getCache(), (req, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countGameActivity());

	const gameActivity = getGameActivity(undefined, page);
	const gamesByDay = getGameActivityGroupedByDay();
	const svg = generateBarGraph(addMissingDates(
		gamesByDay,
		'day',
		(date) => ({ y: 0, label: shortDate(date) }),
	), 'hours');

	res.render('external/game-list', {
		gameActivity,
		svg,
		pagination,
		canonicalUrl: getCanonicalUrl(req),
	});
});

router.get('/game/:id', (req, res) => {
	const gameActivity = getGameActivity(req.params.id);

	if (gameActivity.length === 0) {
		throw new NotFoundError('Like not found');
	}

	res.render('external/game-single', {
		gameActivity: gameActivity[0],
		canonicalUrl: getCanonicalUrl(req),
	});
});

// TV SHOWS

router.get('/tv', getCache(), (req, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countEpisodes());

	const episodes = getEpisodes(undefined, page);

	res.render('external/tv-list', {
		episodes,
		pagination,
		canonicalUrl: getCanonicalUrl(req),
	});
});

router.get('/tv/:id', (req, res) => {
	const episodes = getEpisodes(req.params.id);

	if (episodes.length === 0) {
		throw new NotFoundError('Episode not found');
	}

	res.render('external/tv-single', {
		episode: episodes[0],
		canonicalUrl: getCanonicalUrl(req),
	});
});

// FILMS

router.get('/films', getCache(), (req, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countFilms());

	const films = getFilms(undefined, page);

	res.render('external/film-list', {
		films,
		pagination,
		canonicalUrl: getCanonicalUrl(req),
	});
});

router.get('/film/:id', (req, res) => {
	const films = getFilms(req.params.id);

	if (films.length === 0) {
		throw new NotFoundError('Film not found');
	}

	res.render('external/film-single', {
		film: films[0],
		canonicalUrl: getCanonicalUrl(req),
	});
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
