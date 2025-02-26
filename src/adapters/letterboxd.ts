import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import dotenv from 'dotenv';
import phin from 'phin';
import sax from 'sax';
import { insertFilm } from '../database/films.js';
import { config } from '../lib/config.js';
import { formatDate } from '../lib/formatDate.js';
import Logger from '../lib/logger.js';
import { searchForImagesById, tmdbMovieDetails } from './tmdb.js';

dotenv.config();

const log = new Logger('Letterboxd');

interface LetterboxdFilm {
	title: string;
	link: string;
	guid: string;
	pubDate: Date;
	watchedDate: Date;
	rewatch: string;
	filmTitle: string;
	filmYear: number;
	memberRating?: number;
	creator: string;
	description: string;
	movieId?: number;
	tvId?: number;
}

let filmActivity: LetterboxdFilm[] = [];

function loadFilmsFromDisk() {
	log.info('Loading film cache from disk');
	if (existsSync(config.letterboxd.dataPath) === false) {
		log.debug('Cache file does not exist, providing defaults');
		filmActivity = [];
		return;
	}

	const contents: { filmActivity?: LetterboxdFilm[] } = JSON.parse(
		readFileSync(config.letterboxd.dataPath).toString(),
	);

	filmActivity = (contents.filmActivity || []).map(film => ({
		...film,
		watchedDate: new Date(film.watchedDate),
		pubDate: new Date(film.pubDate),
	}));
}

function saveFilmsToDisk() {
	log.info('Saving film cache to disk');
	const str = JSON.stringify({ filmActivity }, null, 2);
	writeFileSync(config.letterboxd.dataPath, str);
}

async function fetchLetterboxdFeed(username: string) {
	const response = await phin({
		url: `https://letterboxd.com/${username}/rss/`,
		headers: {
			'User-Agent': config.versionString,
		},
		parse: 'string',
	});
	return response.body;
}

async function parseFeed(feed: string): Promise<Partial<LetterboxdFilm>[]> {
	return new Promise((resolve, reject) => {
		const parser = sax.parser(true, { lowercase: true, trim: true });
		const items: Record<string, string | number | Date>[] = [];
		let currentIndex = -1;
		let currentTag = '';
		let writingItem = false;

		parser.onopentag = node => {
			currentTag = node.name;

			const tagSplit = currentTag.split(':');
			if (tagSplit[1] !== undefined) {
				currentTag = tagSplit[1];
			}

			if (node.name === 'item') {
				writingItem = true;
				currentIndex += 1;
				items.push({});
			}
		};

		parser.ontext = text => {
			if (!writingItem) return;
			if (text === '') return;

			let value: string | Date | number = text;

			if (currentTag.includes('Date')) {
				value = new Date(value);
			} else if (!Number.isNaN(Number.parseInt(value, 10))) {
				value = Number(value);
			}

			const item = items[currentIndex] ?? {};
			item[currentTag] = value;
			items[currentIndex] = item;
		};

		parser.oncdata = text => {
			const item = items[currentIndex] ?? {};
			item[currentTag] = text.trim();
			items[currentIndex] = item;
		};

		parser.onclosetag = node => {
			if (node !== 'item') return;

			writingItem = false;
		};

		parser.onend = () => resolve(items);
		parser.onerror = err => reject(err);

		parser.write(feed).close();
	});
}

async function logFilm(film: LetterboxdFilm) {
	// Skip films older than double the interval
	const intervalMs = config.letterboxd.intervalSecs * 1000;
	if (film.watchedDate.getTime() < Date.now() - intervalMs * 2) {
		return;
	}

	const existsInCache = filmActivity.some(filmCached => film.guid === filmCached.guid);
	if (existsInCache) return;

	log.info(`Adding new film '${film.filmTitle} (${film.filmYear})'`);

	// Letterboxd descriptions always start with the poster image URL,
	// so we need to remove that.
	const review = film.guid.includes('letterboxd-review') ? film.description.replace(/<p>.*?<\/p>/, '') : null;

	// TODO: Can we get more useful information out of this request?
	let duration_secs = null;
	if (film.movieId) {
		try {
			const details = await tmdbMovieDetails(film.movieId);
			duration_secs = details.runtime * 60;
		} catch (err) {
			log.error('Failed to retrieve movie details. Ignoring');
			log.error(err);
		}
	}

	const { id } = insertFilm({
		title: film.filmTitle,
		year: film.filmYear,
		rating: film.memberRating ? film.memberRating * 2 : null,
		review,
		url: film.link,
		duration_secs,
		watched_at: formatDate(film.watchedDate),
		created_at: film.pubDate.toISOString(),
		device_id: config.defaultDeviceId,
	});

	// Finally, fetch the image from TMDB
	if (film.movieId) {
		await searchForImagesById(id, film.movieId, 'movie');
	} else if (film.tvId) {
		await searchForImagesById(id, film.tvId, 'tv');
	}
}

export function fetchFilms() {
	const intervalMs = config.letterboxd.intervalSecs * 1000;
	const username = config.letterboxd.username;

	if (username === '' || username === undefined || intervalMs === 0) {
		log.warn(`Will not fetch films due to one of: username = '${username}', intervalMs = '${intervalMs}'.`);
		return;
	}

	loadFilmsFromDisk();

	return async () => {
		const feed = await fetchLetterboxdFeed(username);
		const newActivity = (await parseFeed(feed)).reverse() as LetterboxdFilm[];

		for (const film of newActivity) {
			await logFilm(film);
		}

		filmActivity = newActivity;

		saveFilmsToDisk();
	};
}

export function pollForFilmActivity() {
	const intervalMs = config.letterboxd.intervalSecs * 1000;

	const fetchFn = fetchFilms();
	if (!fetchFn) return;

	setInterval(fetchFn, intervalMs);
}
