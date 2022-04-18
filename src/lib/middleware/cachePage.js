// In order to prevent the SQLite database from being thrashed under high load,
// this caching solution will store the entirety of common pages in memory using
// a very simple singleton object.

import { getCanonicalUrl } from '../getCanonicalUrl.js';
import Logger from '../logger.js';

const logger = new Logger('cache');

/**
 * @typedef {object} CacheObj
 * @property {number} lastUpdate
 * @property {string} contents
 */

/** @type {Record<string, CacheObj>} */
let cache = {};

export default function getCache () {
	/**
	 * @param {import('express').Request} req
	 * @param {import('express').Response} res
	 * @param {import('express').NextFunction} next
	 */
	return (req, res, next) => {
		const key = getCanonicalUrl(req);
		const cacheValue = cache[key];

		const durationSecs = Number(process.env.TOMBOIS_SERVER_CACHE_DURATION_SECS || 600);

		if (durationSecs === 0) {
			next();
			return;
		}

		const durationMs = durationSecs * 1000;
		const lastUpdate = Date.now() - durationMs;

		if (cacheValue?.lastUpdate > lastUpdate) {
			res.send(cacheValue.contents);
			return;
		}

		logger.info(`Caching '${key}' for ${durationSecs} seconds`);

		res.sendResponse = res.send;
		res.send = body => {
			cache[key] = {
				contents: body,
				lastUpdate: Date.now(),
			};
			res.sendResponse(body);
		};
		next();
	};
}
