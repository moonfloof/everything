// In order to prevent the SQLite database from being thrashed under high load,
// this caching solution will store the entirety of common pages in memory using
// a very simple singleton object.

import type { OutgoingHttpHeaders } from 'node:http';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import Logger from '../logger.js';

const logger = new Logger('cache');

interface CacheObj {
	lastUpdateUnixMs: number;
	contents: string;
	headers: OutgoingHttpHeaders;
}

const cache: Map<string, CacheObj> = new Map();

export default function getCache() {
	return (req: Request, res: Response, next: NextFunction) => {
		if (config.cacheDurationSecs === 0 || config.cacheIntervalSecs === 0) {
			next();
			return;
		}

		const key = req.originalUrl;
		const cacheValue = cache.get(key);

		const durationMs = config.cacheDurationSecs * 1000;
		const lastUpdateUnixMs = Date.now() - durationMs;

		if (cacheValue?.lastUpdateUnixMs && cacheValue.lastUpdateUnixMs > lastUpdateUnixMs) {
			res.set(cacheValue.headers);
			res.send(cacheValue.contents);
			return;
		}

		logger.info(`Caching '${key}' for ${config.cacheDurationSecs} seconds`);

		const sendActual = res.send;
		res.send = body => {
			cache.set(key, {
				contents: body,
				headers: res.getHeaders(),
				lastUpdateUnixMs: Date.now(),
			});
			res.send = sendActual;
			res.send(body);
			return body;
		};
		next();
	};
}

export function pollForCacheDeletion() {
	if (config.cacheIntervalSecs <= 0 || config.cacheDurationSecs <= 0) {
		logger.warn('Page caching disabled, all requests will be hot');
		return;
	}

	const intervalDurationMs = config.cacheIntervalSecs * 1000;
	const cacheDurationMs = config.cacheDurationSecs * 1000;

	setInterval(() => {
		for (const [key, value] of cache.entries()) {
			if (value.lastUpdateUnixMs > Date.now() - cacheDurationMs) {
				continue;
			}

			// Remove from cache entirely
			logger.info(`Cache for '${key}' expired. Deleting`);
			cache.delete(key);
		}
	}, intervalDurationMs);
}
