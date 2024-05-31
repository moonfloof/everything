// In order to prevent the SQLite database from being thrashed under high load,
// this caching solution will store the entirety of common pages in memory using
// a very simple singleton object.

import Logger from '../logger.js';

const logger = new Logger('cache');

/**
 * @typedef {object} CacheObj
 * @property {number} lastUpdateUnixMs
 * @property {string} contents
 */

/** @type {Record<string, CacheObj>} */
const cache = {};

export default function getCache() {
	/**
	 * @param {import('express').Request} req
	 * @param {import('express').Response} res
	 * @param {import('express').NextFunction} next
	 */
	return (req, res, next) => {
		const durationSecs = Number(process.env.TOMBOIS_SERVER_CACHE_DURATION_SECS || 600);

		if (durationSecs === 0) {
			next();
			return;
		}

		const key = req.originalUrl;
		const cacheValue = cache[key];

		const durationMs = durationSecs * 1000;
		const lastUpdateUnixMs = Date.now() - durationMs;

		if (cacheValue?.lastUpdateUnixMs > lastUpdateUnixMs) {
			res.send(cacheValue.contents);
			return;
		}

		logger.info(`Caching '${key}' for ${durationSecs} seconds`);

		res.sendResponse = res.send;
		res.send = body => {
			cache[key] = {
				contents: body,
				lastUpdateUnixMs: Date.now(),
			};
			res.sendResponse(body);
		};
		next();
	};
}

export function pollForCacheDeletion() {
	const intervalDurationSecs = Number(process.env.TOMBOIS_SERVER_CACHE_INTERVAL_SECS || 1200);
	const cacheDurationSecs = Number(process.env.TOMBOIS_SERVER_CACHE_DURATION_SECS || 600);

	if (intervalDurationSecs <= 0 || cacheDurationSecs <= 0) {
		return;
	}

	const intervalDurationMs = intervalDurationSecs * 1000;
	const cacheDurationMs = cacheDurationSecs * 1000;

	setInterval(() => {
		for (const key of Object.keys(cache)) {
			if (cache[key].lastUpdateUnixMs > Date.now() - cacheDurationMs) {
				return;
			}

			// Remove from cache entirely
			logger.info(`Cache for '${key}' expired. Deleting`);
			delete cache[key];
		}
	}, intervalDurationMs);
}
