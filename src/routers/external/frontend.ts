import { errors } from '@moonfloof/stdlib';
import express from 'express';
import helmet, { type HelmetOptions } from 'helmet';

// Adapters
import { getNowPlaying } from '../../adapters/listenbrainz.js';
import { getPhotoPositions } from '../../adapters/openstreetmap.js';

// Database
import { countBooks, getBooks } from '../../database/books.js';
import {
	countCheckins,
	getCheckinImageData,
	getCheckinImageThumbnailData,
	getCheckins,
} from '../../database/checkins.js';
import { getDevices } from '../../database/devices.js';
import { countFilms, getFilms } from '../../database/films.js';
import {
	getAchievementsForGame,
	getGameAndTotalPlaytime,
	getGameAssets,
	getSessionsForGame,
} from '../../database/game.js';
import {
	countGameSessions,
	countGameSessionsForDays,
	getAllPerfectedGames,
	getGameSessions,
	getPopularGames,
} from '../../database/gamesession.js';
import {
	countListens,
	getListenActivityGraph,
	getListens,
	getListensPopular,
	groupListens,
} from '../../database/listens.js';
import { getLatestCity } from '../../database/locations.js';
import { countNotes, getNotes } from '../../database/notes.js';
import { getSleepCycles } from '../../database/sleep.js';
import { getSteps, getStepsYesterday } from '../../database/steps.js';
import { countEpisodes, getEpisodes } from '../../database/tv.js';
import { countYouTubeLikes, getLikes, getPopularYouTubeChannels } from '../../database/youtubelikes.js';

// Lib
import { formatTime, prettyDate, prettyDateTime } from '../../lib/formatDate.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import { pageCache } from '../../lib/middleware/cachePage.js';
import { unsafe_stripTags } from '../../lib/strings.js';
import type { RequestFrontend } from '../../types/express.js';

const { NotFoundError } = errors;

const helmetOptions: HelmetOptions = {
	referrerPolicy: {
		policy: ['same-origin'],
	},
	contentSecurityPolicy: {
		directives: {
			'script-src': "'unsafe-inline'",
			'img-src': "'self' https://img.youtube.com",
			'frame-src': 'https://www.youtube-nocookie.com',
		},
	},
};

const router = express.Router();

router.use(pageCache.getCache());
router.use(helmet(helmetOptions));

router.get('/about', (_req, res) => {
	res.render('external/about');
});

// SVGs

router.get('/music.svg', (_req, res) => {
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
			? `My favourite artist in the last ${daysInt} days has been ${popular[0].artist}, who I listened to for ${popular[0].count} hours`
			: `I haven't listened to any music in the last ${daysInt} days!`;

	res.render('external/listen/list', {
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

	res.render('external/listen/single', {
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
			? `My favourite YouTube channel in the last ${daysInt} days has been ${popular[0].channel}, who I watched for ${popular[0].durationPretty}`
			: `I haven't liked any YouTube videos in the last ${daysInt} days!`;

	res.render('external/youtubelike/list', {
		youtubeLikes,
		pagination,
		title: 'watches YouTube',
		description,

		// Popular chart
		days,
		popular,
	});
});

router.get('/youtube/:id', (req, res) => {
	const [youtubeLike] = getLikes({ id: req.params.id, limit: 1 });

	if (!youtubeLike) {
		throw new NotFoundError('Like not found');
	}

	const description = `I liked '${youtubeLike.title}' by ${youtubeLike.channel} on ${prettyDate(
		new Date(youtubeLike.created_at),
	)}`;

	res.render('external/youtubelike/single', {
		youtubeLike,
		title: `watched ${youtubeLike.channel} on ${prettyDate(new Date(youtubeLike.created_at))}`,
		description,
	});
});

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
	const totalStats = countGameSessionsForDays(daysInt);
	const durationHoursTotal = totalStats?.durationHoursTotal ?? 0;
	const achievementsTotal = totalStats?.achievementsTotal ?? 0;
	const title = alltime
		? `spent ${durationHoursTotal} hours playing video games (all time)`
		: showPerfect
			? `has 100% perfected ${popular.length} video games, taking a total of ${durationHoursTotal} hours`
			: `played video games for ${durationHoursTotal} hours in the last ${daysInt} days`;
	const description = `and earned ${achievementsTotal} achievements in that time`;
	const assets = popular[0] !== undefined ? getGameAssets(popular[0].id) : null;

	res.render('external/game/list', {
		sessions,
		pagination,
		title,
		description,
		metaImage: assets?.posterUrl,

		// Popular chart
		popular,
		days: daysString,
		showPerfect,
		totalStats,
	});
});

router.get('/game-session/:id', (req, res) => {
	const [session] = getGameSessions({ id: req.params.id });

	if (!session) {
		throw new NotFoundError('Game not found');
	}

	const assets = getGameAssets(session.game_id);
	const title = `played ${session.name} for ${session.duration} on ${prettyDate(new Date(session.created_at))}`;
	const description = `and got ${session.achievements.length} ${session.achievementText}`;

	res.render('external/game/session', {
		session,
		description,
		title,
		metaImage: assets?.posterUrl,
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
	const sessions = getSessionsForGame(game_id);
	const lastSession = sessions.length > 0 ? sessions[0] : null;
	const hasImage = game.heroUrl !== null;

	res.render('external/game/stats', {
		game,
		gameUrlPretty,
		title,
		sessions,
		lastSession,
		hasImage,
		metaImage: game.posterUrl,
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

	res.render('external/tv/list', {
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

	res.render('external/tv/single', {
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
	const metaImage = films[0]?.posterUrl;

	res.render('external/film/list', {
		films,
		pagination,
		title: 'watches films',
		metaImage,
	});
});

router.get('/film/:id', (req, res) => {
	const [film] = getFilms({ id: req.params.id });

	if (!film) {
		throw new NotFoundError('Film not found');
	}

	const title = `watched ${film.title} (${film.year}) on ${prettyDate(new Date(film.watched_at))}`;
	const watchDate = prettyDate(new Date(film.watched_at));
	let description = film.rating !== null ? `${film.rating}/5` : '';
	if (film.review) {
		if (description) description += ' - ';
		description += unsafe_stripTags(film.review);
	}

	res.render('external/film/single', {
		film,
		title,
		description,
		metaImage: film.posterUrl,
		watchDate,
	});
});

// BOOKS

router.get('/books', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countBooks());

	const books = getBooks({ page });

	res.render('external/book/list', {
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

	res.render('external/book/single', {
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

	res.render('external/checkin/list', {
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
		metaImage = checkin.images[0].thumbnailUrl;
		if (checkin.map_svg !== null) {
			mapImages = getPhotoPositions(checkin.map_svg, checkin.images);
		}
	}

	res.render('external/checkin/single', {
		checkin,
		title,
		description: checkin.summary,
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
		...helmetOptions,
		contentSecurityPolicy: {
			directives: {
				'frame-src': 'https://www.youtube-nocookie.com',
				'script-src': "'unsafe-inline'",
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

	res.render('external/note/list', {
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

	res.render('external/note/single', {
		note,
		description: note.summary,
		title: note.title || 'rambled...',
	});
});

// Finally, render the homepage, using the extra helmet options specified above.
router.get('/', async (_req, res) => {
	const devices = getDevices();
	if (devices.length === 0) {
		res.render('external/setup-required');
		return;
	}

	const nowPlaying = getNowPlaying();
	const latestCheckin = getCheckins({ limit: 1 })[0];
	const latestGame = getGameSessions({ limit: 1 })[0];
	const latestFilm = getFilms({ limit: 1 })[0];
	const latestLocation = getLatestCity();
	const latestSleep = getSleepCycles({ limit: 1 })[0];
	const latestSteps = getStepsYesterday();
	const showDashboard =
		latestCheckin || latestGame || latestFilm || latestLocation || latestSleep || latestSteps || nowPlaying;

	const parameters = { limit: 10000, days: 7 };

	// biome-ignore lint/suspicious/noExplicitAny: It doesn't matter what the data is.
	const typeMap = (type: string, entries: Record<string, any>[]) =>
		entries.map(data => ({
			type,
			created_at: new Date(data.created_at),
			created_at_pretty: prettyDateTime(new Date(data.created_at)),
			data,
		}));

	const entries = (
		await Promise.all([
			typeMap('game', getGameSessions(parameters)),
			typeMap('listen', groupListens(getListens(parameters))),
			typeMap('note', getNotes({ ...parameters, status: 'public' })),
			typeMap('episode', getEpisodes(parameters)),
			typeMap('film', getFilms(parameters)),
			typeMap('book', getBooks(parameters)),
			typeMap('like', getLikes(parameters)),
			typeMap('checkin', getCheckins({ ...parameters, status: 'public', maxImageCount: 4 })),
			typeMap('steps', getSteps(parameters)),
		])
	).flat(1);

	entries.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

	res.render('external/feed', {
		entries,
		latestCheckin,
		latestGame,
		latestFilm,
		latestLocation,
		latestSleep,
		latestSteps,
		nowPlaying,
		showDashboard,
	});
});

// NOT FOUND

router.get('*url', () => {
	throw new NotFoundError('Page Not Found');
});

export default router;
