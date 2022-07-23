import sax from 'sax';
import phin from 'phin';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { formatDate, minuteMs, weekMs } from '../lib/formatDate.js';
import Logger from '../lib/logger.js';
import { insertFilm } from '../database/films.js';

dotenv.config();

const log = new Logger('Letterboxd');

/**
 * @typedef  {object} LetterboxdFilm
 * @property {string} title
 * @property {string} link
 * @property {string} guid
 * @property {Date}   pubDate
 * @property {Date}   watchedDate
 * @property {string} rewatch
 * @property {string} filmTitle
 * @property {number} filmYear
 * @property {number} [memberRating]
 * @property {string} creator
 */

/** @type {LetterboxdFilm[]} */
let filmActivity = [];

const storagePath = () => path.resolve(process.env.TOMBOIS_LETTERBOXD_DATA_FILE);

const loadFilmsFromDisk = () => {
	log.info('Loading film cache from disk');
	if (fs.existsSync(storagePath()) === false) {
		log.debug('Cache file does not exist, providing defaults');
		filmActivity = [];
		return;
	}

	const contents = JSON.parse(fs.readFileSync(storagePath()).toString());

	filmActivity = (contents.filmActivity || []).map(film => ({
		...film,
		watchedDate: new Date(film.watchedDate),
		pubDate: new Date(film.pubDate),
	}));
};

const saveFilmsToDisk = () => {
	log.info('Saving film cache to disk');
	const str = JSON.stringify({ filmActivity }, null, 2);
	fs.writeFileSync(storagePath(), str);
};

const fetchLetterboxdFeed = async (username) => {
	const response = await phin({
		url: `https://letterboxd.com/${username}/rss/`,
		parse: 'string',
	});
	return response.body;
};

/**
 * @param {string} feed
 * @returns {Promise<LetterboxdFilm[]>}
*/
const parseFeed = async (feed) => new Promise((resolve, reject) => {
	const parser = sax.parser(true, { lowercase: true, trim: true });
	const items = [];
	let currentIndex = -1;
	let currentTag = '';
	let writingItem = false;

	parser.onopentag = (node) => {
		currentTag = node.name;

		if (currentTag.includes(':')) {
			currentTag = currentTag.split(':')[1];
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

		let value = text;

		if (currentTag.includes('Date')) {
			value = new Date(value);
		} else if (!isNaN(parseInt(value, 10))) {
			value = Number(value);
		}

		items[currentIndex][currentTag] = value;
	};

	parser.onclosetag = node => {
		if (node !== 'item') return;

		writingItem = false;
	};

	parser.onend = () => resolve(items);
	parser.onerror = (err) => reject(err);

	parser.write(feed).close();
});

export const pollForFilmActivity = async () => {
	const deviceId = process.env.TOMBOIS_DEFAULT_DEVICE_ID;
	const username = process.env.TOMBOIS_LETTERBOXD_USERNAME;
	const intervalMins = Number(process.env.TOMBOIS_LETTERBOXD_POLL_INTERVAL) ?? 1440;
	const intervalMs = intervalMins * minuteMs;

	if (username === '' || username === undefined) return;
	if (intervalMs === 0) return;

	loadFilmsFromDisk();

	const fetchFilms = async () => {
		const feed = await fetchLetterboxdFeed(username);
		const newActivity = (await parseFeed(feed)).reverse();

		newActivity.forEach(film => {
			const existsInCache = filmActivity.some(filmCached => {
				if (film.guid === filmCached.guid) {
					return filmCached.watchedDate.getTime() < Date.now() - (weekMs * 2);
				}
				return false;
			});

			if (existsInCache) return;

			log.info(`Adding new film '${film.filmTitle} (${film.filmYear})'`);

			insertFilm(
				film.filmTitle,
				film.filmYear,
				film.memberRating ? film.memberRating * 2 : null,
				film.link,
				formatDate(film.watchedDate),
				film.pubDate.toISOString(),
				deviceId,
			);
		});

		filmActivity = newActivity;

		saveFilmsToDisk();
	};

	setInterval(fetchFilms, intervalMs);
};
