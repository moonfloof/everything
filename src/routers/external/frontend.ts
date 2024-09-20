import { errors } from '@tombofry/stdlib';
const { NotFoundError } = errors;
import express from 'express';
import helmet from 'helmet';

// Database
import { countBooks, getBooks } from '../../database/books.js';
import { getDevices } from '../../database/devices.js';
import { countFilms, getFilms } from '../../database/films.js';
import {
	countGameActivity,
	getGameActivity,
	getGameActivityGroupedByDay,
	getGameStats,
	getPopularGames,
} from '../../database/games.js';
import {
	countListens,
	getListenDashboardGraph,
	getListenGraph,
	getListenPopularDashboard,
	getListens,
	getListensPopular,
	getPopularAlbumWithArtist,
	groupListens,
} from '../../database/listens.js';
import { getLatestCity } from '../../database/locations.js';
import { countNotes, getNotes } from '../../database/notes.js';
import { getSleepStats } from '../../database/sleep.js';
import { getStepsYesterday } from '../../database/steps.js';
import { countEpisodes, getEpisodes } from '../../database/tv.js';
import { countYouTubeLikes, getLikes, getPopularYouTubeChannels } from '../../database/youtubelikes.js';

// Lib
import addMissingDates from '../../lib/addMissingDates.js';
import { formatTime, prettyDate, shortDate } from '../../lib/formatDate.js';
import { getCanonicalUrl } from '../../lib/getCanonicalUrl.js';
import { generateBarGraph } from '../../lib/graphs/bar.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import { pageCache } from '../../lib/middleware/cachePage.js';

// Others
import { getNowPlaying } from '../../adapters/listenbrainz.js';
import type { RequestFrontend } from '../../types/express.js';
import { generateSmallBarGraph, generateSmallBarRectangles } from '../../lib/graphs/barSmall.js';

const router = express.Router();

// DASHBOARD

router.use(pageCache.getCache());

router.get('/', (req, res) => {
	const devices = getDevices();
	if (devices.length === 0) {
		res.render('external/setup-required');
		return;
	}

	const listens = getListenPopularDashboard(7);
	const youtubeLikes = getLikes().slice(0, 2);
	const tvEpisodes = getEpisodes().slice(0, 2);
	const films = getFilms().slice(0, 2);
	const gameStats = getGameStats();
	const device = devices[0];
	const location = getLatestCity();
	const steps = getStepsYesterday()?.step_count_total;
	const sleepStats = getSleepStats();
	const books = getBooks().slice(0, 2);
	const notes = getNotes().slice(0, 5);

	res.render('external/dashboard', {
		sleepStats,
		listens,
		youtubeLikes,
		tvEpisodes,
		films,
		books,
		gameStats,
		notes,
		device,
		steps,
		location,
		canonicalUrl: getCanonicalUrl(req),
	});
});

// SVGs

router.get('/music.svg', (req, res) => {
	const nowPlaying = getNowPlaying();
	const favourite = getPopularAlbumWithArtist(14);
	const listenGraph = generateSmallBarRectangles(
		addMissingDates(getListenDashboardGraph(), day => ({ day, min: 0, max: 0 })),
	);

	const nowPlayingText =
		nowPlaying?.artist && nowPlaying.title
			? `<text style="font-size: 12px; font-weight: 400;" fill="#4d4d4d" x="96" y="92">now playing</text>
			   <text style="font-size: 16px; font-weight: 700;" fill="#1a1a1a" x="96" y="108">${nowPlaying.title}, by ${nowPlaying.artist}</text>`
			: '';

	const favouriteText =
		favourite?.album && favourite?.artist
			? `<text style="font-size: 12px; font-weight: 400;" fill="#4d4d4d" x="96" y="52">favourite album</text>
			   <text style="font-size: 16px; font-weight: 700;" fill="#1a1a1a" x="96" y="68">${favourite.album}, by ${favourite.album}</text>`
			: '';

	res.type('image/svg+xml').send(`<?xml version="1.0" ?>
	<svg width="400" height="120" viewBox="0 0 400 120" version="1.1" xmlns="http://www.w3.org/2000/svg">
		<text style="font-size: 16px; font-weight: 400;" fill="#3e3475" x="8" y="20">scrobble history (last 14 days)</text>
		${favouriteText}
		${nowPlayingText}
		<g transform="translate(8,32)">${listenGraph}</g>
	</svg>`);
});

// LISTENS

router.get('/music', (req: RequestFrontend, res) => {
	const { page = 0, days = '7' } = req.query;
	const pagination = handlebarsPagination(page, countListens());

	const daysInt = Number(days);
	const dayOptions = [
		{ value: 7, selected: daysInt === 7 },
		{ value: 14, selected: daysInt === 14 },
		{ value: 30, selected: daysInt === 30 },
		{ value: 60, selected: daysInt === 60 },
	];

	if (!Number.isSafeInteger(daysInt) || daysInt < 1 || daysInt > 60) {
		throw new Error('"days" query must be a number between 1 and 60');
	}

	const nowPlaying = getNowPlaying();
	const listens = getListens({ page });
	const popular = getListensPopular(daysInt);
	const graphPoints = getListenGraph();
	const svg = generateBarGraph(
		addMissingDates(graphPoints, date => ({ y: 0, label: shortDate(date) })),
		'scrobbles',
	);

	const description =
		popular.length > 0
			? `My favourite artist in the last ${daysInt} days has been ${popular[0].artist}, with ${popular[0].count} listens`
			: `I haven't listened to any music in the last ${daysInt} days!`;

	res.render('external/listen-list', {
		nowPlaying,
		listens,
		pagination,
		svg,
		canonicalUrl: getCanonicalUrl(req),
		title: 'listens to music',
		description,

		// Popular chart
		days,
		dayOptions,
		popular,
	});
});

router.get('/music/:id', (req, res) => {
	const [listen] = getListens({ id: req.params.id });

	if (!listen) {
		throw new NotFoundError('Listen not found');
	}

	const at = new Date(listen.created_at);
	const description = `I listened to '${listen.title}' by ${listen.artist} on ${prettyDate(at)} at ${formatTime(
		at,
		false,
	)}`;

	res.render('external/listen-single', {
		listen,
		title: 'listened to...',
		description,
		canonicalUrl: getCanonicalUrl(req),
	});
});

// YOUTUBE LIKES

router.get('/youtube', (req: RequestFrontend, res) => {
	const { page = 0, days = '60' } = req.query;
	const pagination = handlebarsPagination(page, countYouTubeLikes());

	const daysInt = Number(days);
	const dayOptions = [
		{ value: 60, selected: daysInt === 60 },
		{ value: 180, selected: daysInt === 180 },
		{ value: 365, selected: daysInt === 365 },
	];

	if (!Number.isSafeInteger(daysInt) || daysInt < 60 || daysInt > 365) {
		throw new Error('"days" query must be a number between 60 and 365');
	}

	const youtubeLikes = getLikes({ page });
	const popular = getPopularYouTubeChannels(daysInt);

	const description =
		popular.length > 0
			? `My favourite YouTube channel in the last ${daysInt} days has been ${popular[0].channel}, with ${popular[0].count} likes`
			: `I haven't liked any YouTube videos in the last ${daysInt} days!`;

	res.render('external/youtubelike-list', {
		youtubeLikes,
		pagination,
		title: 'watches YouTube',
		description,
		canonicalUrl: getCanonicalUrl(req),

		// Popular chart
		days,
		dayOptions,
		popular,
	});
});

router.get('/youtube/:id', (req, res) => {
	const [youtubeLike] = getLikes({ id: req.params.id });

	if (!youtubeLike) {
		throw new NotFoundError('Like not found');
	}

	const description = `I liked '${youtubeLike.title}' by ${youtubeLike.channel} on ${prettyDate(
		new Date(youtubeLike.created_at),
	)}`;

	res.render('external/youtubelike-single', {
		youtubeLike,
		title: 'watched...',
		description,
		canonicalUrl: getCanonicalUrl(req),
	});
});

// STEAM ACTIVITY

router.get('/games', (req: RequestFrontend, res) => {
	const { page = 0, days = '60' } = req.query;
	const pagination = handlebarsPagination(page, countGameActivity());

	const daysInt = Number(days);
	const dayOptions = [
		{ value: 60, selected: daysInt === 60 },
		{ value: 180, selected: daysInt === 180 },
		{ value: 365, selected: daysInt === 365 },
	];

	if (!Number.isSafeInteger(daysInt) || daysInt < 60 || daysInt > 365) {
		throw new Error('"days" query must be a number between 1 and 60');
	}

	const gameActivity = getGameActivity({ page });
	const gamesByDay = getGameActivityGroupedByDay();
	const popular = getPopularGames(daysInt);
	const svg = generateBarGraph(
		addMissingDates(gamesByDay, date => ({ y: 0, label: shortDate(date) })),
		'hours',
	);

	res.render('external/game-list', {
		gameActivity,
		svg,
		pagination,
		title: 'plays video games',
		canonicalUrl: getCanonicalUrl(req),

		// Popular chart
		popular,
		days,
		dayOptions,
	});
});

router.get('/game/:id', (req, res) => {
	const [gameActivity] = getGameActivity({ id: req.params.id });

	if (!gameActivity) {
		throw new NotFoundError('Game not found');
	}

	const description = `I played ${gameActivity.name} for ${gameActivity.duration} on ${prettyDate(
		new Date(gameActivity.created_at),
	)}`;

	res.render('external/game-single', {
		gameActivity,
		description,
		title: 'played...',
		canonicalUrl: getCanonicalUrl(req),
	});
});

// TV SHOWS

router.get('/tv', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countEpisodes());

	const episodes = getEpisodes({ page });

	res.render('external/tv-list', {
		episodes,
		pagination,
		title: 'watches TV',
		canonicalUrl: getCanonicalUrl(req),
	});
});

router.get('/tv/:id', (req, res) => {
	const [episode] = getEpisodes({ id: req.params.id });

	if (!episode) {
		throw new NotFoundError('Episode not found');
	}

	const description = `I watched '${episode.episode_title}' of ${episode.series_title} on ${prettyDate(
		new Date(episode.created_at),
	)}`;

	res.render('external/tv-single', {
		episode,
		description,
		title: 'watched...',
		canonicalUrl: getCanonicalUrl(req),
	});
});

// FILMS

router.get('/films', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countFilms());

	const films = getFilms({ page });

	res.render('external/film-list', {
		films,
		pagination,
		title: 'watches films',
		canonicalUrl: getCanonicalUrl(req),
	});
});

router.get('/film/:id', (req, res) => {
	const [film] = getFilms({ id: req.params.id });

	if (!film) {
		throw new NotFoundError('Film not found');
	}

	const description = `I watched ${film.title} (${film.year}) on ${prettyDate(new Date(film.watched_at))}`;

	res.render('external/film-single', {
		film,
		description,
		title: 'watched...',
		canonicalUrl: getCanonicalUrl(req),
	});
});

// BOOKS

router.get('/books', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countBooks());

	const books = getBooks({ page });

	res.render('external/book-list', {
		books,
		pagination,
		title: 'reads books',
		canonicalUrl: getCanonicalUrl(req),
	});
});

router.get('/book/:id', (req, res) => {
	const [book] = getBooks({ id: req.params.id });

	if (!book) {
		throw new NotFoundError('Book not found');
	}

	const percentageComplete =
		book.pages_total && book.pages_progress
			? Math.round((book.pages_progress / book.pages_total) * 100)
			: 0;

	const prefix =
		percentageComplete === 100 ? 'I finished reading' : `I am ${percentageComplete}% through reading`;

	const prefixTitle = percentageComplete === 100 ? 'read...' : 'is reading...';

	const suffix = percentageComplete === 100 ? ` on ${prettyDate(new Date(book.completed_at))}` : '';

	const description = `${prefix} '${book.title}' (${book.year}) by ${book.author}${suffix}`;

	res.render('external/book-single', {
		book,
		description,
		title: prefixTitle,
		canonicalUrl: getCanonicalUrl(req),
	});
});

// NOTES

// Disable media-src CSP for Notes, as we may want to embed <audio> and <video>
// sources from other domains. ⚠ As a result, you are responsible for posting
// reliable/trust-worthy sources (eg. from your own domains).
router.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				'media-src': 'https:',
				'img-src': 'https:',
			},
		},
	}),
);

router.get('/notes', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countNotes());

	const notes = getNotes({ status: 'public', page });

	res.render('external/note-list', {
		notes,
		pagination,
		title: 'rambles',
		canonicalUrl: getCanonicalUrl(req),
	});
});

router.get('/note/:id', (req, res) => {
	const [note] = getNotes({ id: req.params.id });

	if (!note) {
		throw new NotFoundError('Note not found');
	}

	res.render('external/note-single', {
		note,
		description: note.summary,
		title: note.title || 'rambled...',
		canonicalUrl: getCanonicalUrl(req),
	});
});

// GLOBAL FEED

router.get('/feed', async (_req, res) => {
	const parameters = { limit: 1000, days: 7 };

	// biome-ignore lint/suspicious/noExplicitAny: It doesn't matter what the data is.
	const typeMap = (type: string, entries: Record<string, any>[]) =>
		entries.map(data => ({
			type,
			created_at: new Date(data.created_at),
			data,
		}));

	// None of these are promises, but my original thought was that this
	// would fetch them all in parallel. I'll have to benchmark whether this
	// is actually more performant or not...
	// TODO: Benchmark Promise.all vs. one by one
	const entries = (
		await Promise.all([
			typeMap('game', getGameActivity(parameters)),
			typeMap('listen', groupListens(getListens(parameters))),
			typeMap('note', getNotes({ ...parameters, status: 'public' })),
			typeMap('episode', getEpisodes(parameters)),
			typeMap('film', getFilms(parameters)),
			typeMap('book', getBooks(parameters)),
			typeMap('like', getLikes(parameters)),
		])
	).flat(1);

	entries.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

	res.render('external/feed', {
		entries,
		title: ' / The Everything Feed',
		description: "Everything I've done from the last seven days, on one page!",
	});
});

// NOT FOUND

router.get('*', () => {
	throw new NotFoundError('Page Not Found');
});

export default router;
