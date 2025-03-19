import { errors } from '@moonfloof/stdlib';
const { NotFoundError } = errors;
import { existsSync } from 'node:fs';
import express from 'express';
import helmet from 'helmet';

// Database
import { countBooks, getBooks } from '../../database/books.js';
import { getDevices } from '../../database/devices.js';
import { countFilms, getFilms } from '../../database/films.js';
import { getAchievementsForGame, getGameAndTotalPlaytime, getSessionsForGame } from '../../database/game.js';
import {
	countGameSessions,
	getAllPerfectedGames,
	getGameSessions,
	getGameStats,
	getPopularGames,
} from '../../database/gamesession.js';
import {
	countListens,
	getListenActivityGraph,
	getListenPopularDashboard,
	getListens,
	getListensPopular,
	groupListens,
} from '../../database/listens.js';
import { getLatestCity } from '../../database/locations.js';
import { countNotes, getNotes } from '../../database/notes.js';
import { getSleepStats } from '../../database/sleep.js';
import { getStepsYesterday } from '../../database/steps.js';
import { countEpisodes, getEpisodes } from '../../database/tv.js';
import { countYouTubeLikes, getLikes, getPopularYouTubeChannels } from '../../database/youtubelikes.js';

// Lib
import { config } from '../../lib/config.js';
import { formatTime, prettyDate } from '../../lib/formatDate.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import { getImagePath } from '../../lib/mediaFiles.js';
import { pageCache } from '../../lib/middleware/cachePage.js';

// Others
import { getNowPlaying } from '../../adapters/listenbrainz.js';
import {
	countCheckins,
	getCheckinImageData,
	getCheckinImageThumbnailData,
	getCheckins,
} from '../../database/checkins.js';
import type { RequestFrontend } from '../../types/express.js';
import { getPhotoPositions } from '../../adapters/openstreetmap.js';

const router = express.Router();

// DASHBOARD

router.use(pageCache.getCache());

router.get('/', (req, res) => {
	const devices = getDevices();
	if (devices.length === 0) {
		res.render('external/setup-required');
		return;
	}

	const listens = getListenPopularDashboard(14);
	const youtubeLikes = getLikes().slice(0, 2);
	const tvEpisodes = getEpisodes().slice(0, 2);
	const films = getFilms().slice(0, 2);
	const gameStats = getGameStats(14);
	const device = devices[0];
	const location = getLatestCity();
	const steps = getStepsYesterday()?.step_count_total;
	const sleepStats = getSleepStats();
	const books = getBooks().slice(0, 2);
	const notes = getNotes().slice(0, 5);
	const checkins = getCheckins().slice(0, 2);

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
		checkins,
	});
});

// SVGs

router.get('/music.svg', (req, res) => {
	res.header('Cache-Control', 'public, max-age=1200, immutable');
	res.type('image/svg+xml').send(`<?xml version="1.0" ?>${getListenActivityGraph()}`);
});

// LISTENS

router.get('/music', (req: RequestFrontend, res) => {
	const { page = 0, days = '7' } = req.query;
	const pagination = handlebarsPagination(page, countListens());

	if (!['7', '30', '60', '365'].includes(days)) {
		throw new Error('"days" must be 7, 30, 60, or 365');
	}
	const daysInt = Number(days);

	const nowPlaying = getNowPlaying();
	const listens = getListens({ page });
	const popular = getListensPopular(daysInt);
	const activityGraph = getListenActivityGraph();
	const title = popular.length === 0 ? 'listens to music (sometimes, apparently)' : 'listens to music';

	const description =
		popular[0] !== undefined
			? `My favourite artist in the last ${daysInt} days has been ${popular[0].artist}, with ${popular[0].count} listens`
			: `I haven't listened to any music in the last ${daysInt} days!`;

	res.render('external/listen-list', {
		nowPlaying,
		listens,
		pagination,
		title,
		description,

		// Popular chart
		days,
		popular,
		activityGraph,
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
	});
});

// YOUTUBE LIKES

router.get('/youtube', (req: RequestFrontend, res) => {
	const { page = 0, days = '180' } = req.query;
	const pagination = handlebarsPagination(page, countYouTubeLikes());

	if (!['14', '30', '180', '365'].includes(days)) {
		throw new Error('"days" must be 14, 30, 180, or 365');
	}
	const daysInt = Number(days);

	const youtubeLikes = getLikes({ page });
	const popular = getPopularYouTubeChannels(daysInt);

	const description =
		popular[0] !== undefined
			? `My favourite YouTube channel in the last ${daysInt} days has been ${popular[0].channel}, with ${popular[0].count} likes`
			: `I haven't liked any YouTube videos in the last ${daysInt} days!`;

	res.render('external/youtubelike-list', {
		youtubeLikes,
		pagination,
		title: 'watches YouTube',
		description,

		// Popular chart
		days,
		popular,
	});
});

// Configure helmet to allow youtube-nocookie iframes for this URL ONLY
router.use(
	helmet({
		...config.helmet,
		contentSecurityPolicy: {
			directives: { 'frame-src': 'https://www.youtube-nocookie.com' },
		},
	}),
);
router.get('/youtube/:id', (req, res) => {
	const [youtubeLike] = getLikes({ id: req.params.id, limit: 1 });

	if (!youtubeLike) {
		throw new NotFoundError('Like not found');
	}

	const description = `I liked '${youtubeLike.title}' by ${youtubeLike.channel} on ${prettyDate(
		new Date(youtubeLike.created_at),
	)}`;

	res.render('external/youtubelike-single', {
		youtubeLike,
		title: `watched ${youtubeLike.channel} on ${prettyDate(new Date(youtubeLike.created_at))}`,
		description,
	});
});
router.use(helmet(config.helmet));

// STEAM ACTIVITY

router.get('/games', (req: RequestFrontend, res) => {
	const { page = 0, days = '60', perfect } = req.query;
	const pagination = handlebarsPagination(page, countGameSessions());

	// Set "alltime" to 6000 days, which is 16.4 years - I think this'll cover it!
	const alltime = days === 'alltime';
	const daysInt = Number(alltime ? 6000 : days);
	const daysString = days === 'alltime' ? 'all time' : `last ${daysInt} days`;
	if (!Number.isSafeInteger(daysInt) || (daysInt !== 6000 && (daysInt < 14 || daysInt > 365))) {
		throw new Error('"days" query must be a number between 14 and 365');
	}

	const showPerfect = perfect !== undefined;
	const sessions = getGameSessions({ page });
	const popular = showPerfect ? getAllPerfectedGames() : getPopularGames(daysInt);
	const durationHoursTotal = popular.reduce((total, game) => total + game.playtime_hours, 0);
	const achievementsTotal = popular.reduce((count, game) => count + game.achievements_unlocked_in_time, 0);
	const title = alltime
		? `spent ${durationHoursTotal} hours playing video games (all time)`
		: showPerfect
			? `has 100% perfected ${popular.length} video games, taking a total of ${durationHoursTotal} hours`
			: `played video games for ${durationHoursTotal} hours in the last ${daysInt} days`;
	const description = `and earned ${achievementsTotal} achievements in that time`;

	res.render('external/game-list', {
		sessions,
		pagination,
		title,
		description,

		// Popular chart
		popular,
		days: daysString,
		showPerfect,
		achievementsTotal,
	});
});

router.get('/game-session/:id', (req, res) => {
	const [session] = getGameSessions({ id: req.params.id });

	if (!session) {
		throw new NotFoundError('Game not found');
	}

	const title = `played ${session.name} for ${session.duration} on ${prettyDate(new Date(session.created_at))}`;
	const description = `and got ${session.achievements.length} ${session.achievementText}`;

	res.render('external/game-session', {
		session,
		description,
		title,
	});
});

router.get('/game/:id', (req, res) => {
	const { id } = req.params;

	const game_id = Number(id);
	if (!Number.isSafeInteger(game_id) || game_id < 0) {
		throw new Error('Invalid game ID');
	}

	const game = getGameAndTotalPlaytime(game_id);
	if (!game) {
		throw new Error('Game does not exist');
	}

	const title = `has played ${game.name} for ${game.playtime_hours} hours`;
	const gameUrlPretty = game.url ? new URL(game.url).host : null;
	const achievements = getAchievementsForGame(game_id);
	const achievementsUnlockedCount = achievements.filter(a => a.unlocked_session_id !== null).length;
	const achievementPercentage = Math.round((achievementsUnlockedCount / achievements.length) * 100);
	const lastSession = getSessionsForGame(game_id)[0];
	const hasImage = existsSync(getImagePath('game', `hero-${game.id}`));

	// TODO: Remove after a substantial amount of time, once achievements can be properly updated.
	const lastUpdateCutoff = new Date('2024-12-14').getTime();
	const lastPlayedTime = new Date(game.last_played).getTime();
	const lastUpdatedAchievements = achievements.reduce((time, achievement) => {
		const newTime = new Date(achievement.created_at).getTime();
		return newTime > time ? newTime : time;
	}, 0);

	const playedRecently =
		achievementPercentage < 100 ||
		lastPlayedTime > lastUpdateCutoff ||
		lastUpdatedAchievements > lastUpdateCutoff;

	res.render('external/game-stats', {
		game,
		gameUrlPretty,
		title,
		playedRecently,
		lastSession,
		hasImage,
		achievements,
		achievementsUnlockedCount,
		achievementPercentage,
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
	});
});

router.get('/film/:id', (req, res) => {
	const [film] = getFilms({ id: req.params.id });

	if (!film) {
		throw new NotFoundError('Film not found');
	}

	const title = `watched ${film.title} (${film.year}) on ${prettyDate(new Date(film.watched_at))}`;
	const description = film.rating !== null ? `and rated it ${film.rating}/10` : null;
	const rating = film.rating !== null ? '⭐'.repeat(film.rating) : '';
	const watchDate = prettyDate(new Date(film.watched_at));

	res.render('external/film-single', {
		film,
		title,
		description,
		rating,
		watchDate,
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

	const suffix =
		percentageComplete === 100 && book.completed_at ? ` on ${prettyDate(new Date(book.completed_at))}` : '';

	const description = `${prefix} '${book.title}' (${book.year}) by ${book.author}${suffix}`;

	res.render('external/book-single', {
		book,
		description,
		title: prefixTitle,
	});
});

// CHECK-INS

router.get('/checkin', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countCheckins());

	const checkins = getCheckins({ page, status: 'public' });

	res.render('external/checkin-list', {
		checkins,
		pagination,
		title: 'goes places',
	});
});

router.get('/checkin/:checkin_id', (req, res) => {
	const [checkin] = getCheckins({ id: req.params.checkin_id, status: 'public' });

	if (checkin === undefined) {
		throw new NotFoundError('Check-in not found');
	}

	let title = `went to ${checkin.name} on ${prettyDate(new Date(checkin.created_at))}`;
	let metaImage: string | null = null;
	let mapImages: { id: string; left: number; top: number }[] = [];

	if (checkin.images.length > 0 && checkin.images[0] !== undefined) {
		title = `${title} and took ${checkin.images.length} photos`;
		metaImage = `/checkin/image/${checkin.images[0].id}.avif`;
		if (checkin.map_svg !== null) {
			mapImages = getPhotoPositions(checkin.map_svg, checkin.images);
		}
	}

	res.render('external/checkin-single', {
		checkin,
		title,
		description: checkin.description,
		metaImage,
		mapImages,
	});
});

router.get('/checkin/image/:image_id', (req, res) => {
	const { image_id } = req.params;
	const id = image_id.replace('.avif', '');
	const image = getCheckinImageData(id);

	if (image === undefined) {
		throw new NotFoundError(`Image '${req.params.image_id}' does not exist`);
	}

	// Set cache header to 2 weeks
	res.header('Cache-Control', 'public, max-age=1209600, immutable');

	res.type('image/avif').send(image);
});

router.get('/checkin/image-thumbnail/:image_id', async (req, res) => {
	const { image_id } = req.params;
	const id = image_id.replace('.avif', '');
	const image = await getCheckinImageThumbnailData(id);

	if (image === undefined) {
		throw new NotFoundError(`Image '${req.params.image_id}' does not exist`);
	}

	// Set cache header to 2 weeks
	res.header('Cache-Control', 'public, max-age=1209600, immutable');

	res.type('image/avif').send(image);
});

// NOTES

// Disable media-src CSP for Notes, as we may want to embed <audio> and <video>
// sources from other domains. ⚠ As a result, you are responsible for posting
// reliable/trust-worthy sources (eg. from your own domains).
router.use(
	helmet({
		...config.helmet,
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
			typeMap('game', getGameSessions(parameters)),
			typeMap('listen', groupListens(getListens(parameters))),
			typeMap('note', getNotes({ ...parameters, status: 'public' })),
			typeMap('episode', getEpisodes(parameters)),
			typeMap('film', getFilms(parameters)),
			typeMap('book', getBooks(parameters)),
			typeMap('like', getLikes(parameters)),
			typeMap('checkin', getCheckins({ ...parameters, status: 'public' })),
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

router.get('*url', () => {
	throw new NotFoundError('Page Not Found');
});

export default router;
