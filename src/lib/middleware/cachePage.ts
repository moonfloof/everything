// In order to prevent the SQLite database from being thrashed under high load,
// this caching solution will store the entirety of common pages in memory using
// a very simple singleton object.

import type { OutgoingHttpHeaders } from 'node:http';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import Logger from '../logger.js';

interface CacheObj {
	lastUpdateUnixMs: number;
	contents: string;
	headers: OutgoingHttpHeaders;
}

class PageCache {
	#cache: Map<string, CacheObj> = new Map();
	#logger = new Logger('cache');

	get cache() {
		return this.#cache.entries();
	}

	public getCache() {
		return (req: Request, res: Response, next: NextFunction) => {
			if (config.cacheDurationSecs === 0 || config.cacheIntervalSecs === 0) {
				next();
				return;
			}

			const key = req.originalUrl;
			const cacheValue = this.#cache.get(key);

			const durationMs = config.cacheDurationSecs * 1000;
			const lastUpdateUnixMs = Date.now() - durationMs;

			if (cacheValue?.lastUpdateUnixMs && cacheValue.lastUpdateUnixMs > lastUpdateUnixMs) {
				res.set(cacheValue.headers);
				res.send(cacheValue.contents);
				return;
			}

			this.#logger.info(`Caching '${key}' for ${config.cacheDurationSecs} seconds`);

			const sendActual = res.send;
			res.send = body => {
				this.#cache.set(key, {
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

	public deleteCacheEntry(url: string) {
		if (!this.#cache.has(url)) {
			this.#logger.error(`The URL '${url}' does not exist in cache`);
			throw new Error('This page does not exist in cache');
		}

		this.#cache.delete(url);
	}

	public purgeAllCache() {
		this.#cache.clear();
	}

	public pollForCacheDeletion() {
		if (config.cacheIntervalSecs <= 0 || config.cacheDurationSecs <= 0) {
			this.#logger.warn('Page caching disabled, all requests will be hot');
			return;
		}

		const intervalDurationMs = config.cacheIntervalSecs * 1000;
		const cacheDurationMs = config.cacheDurationSecs * 1000;

		setInterval(() => {
			for (const [key, value] of this.#cache.entries()) {
				if (value.lastUpdateUnixMs > Date.now() - cacheDurationMs) {
					continue;
				}

				// Remove from cache entirely
				this.#logger.info(`Cache for '${key}' expired. Deleting`);
				this.#cache.delete(key);
			}
		}, intervalDurationMs);
	}
}

export const pageCache = new PageCache();
