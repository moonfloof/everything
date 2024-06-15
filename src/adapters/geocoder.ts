import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import cron from 'node-cron';
import phin from 'phin';
import { config } from '../lib/config.js';
import { weekMs } from '../lib/formatDate.js';
import Logger from '../lib/logger.js';

interface OpenStreetMapResponse {
	address: {
		city?: string;
		town?: string;
		village?: string;
		hamlet?: string;
		suburb?: string;
		state?: string;
	};
}

const log = new Logger('geocoder');

let cache: Record<string, { city?: string; state?: string; retrievedAt: number }> = {};

export function initLocationCache() {
	if (!config.geocoder.enabled) return;

	cron.schedule('0 1 * * *', cleanCache, { name: 'geocoder-cache' });

	if (!existsSync(config.geocoder.cachePath)) {
		saveLocationCache();
		return;
	}

	const contents = JSON.parse(readFileSync(config.geocoder.cachePath).toString());
	cache = contents.cache || {};

	log.info(`Loaded ${Object.keys(cache).length} locations into cache`);
}

function saveLocationCache() {
	log.info('Saving location cache to disk');
	const str = JSON.stringify({ cache }, null, '\t');
	writeFileSync(config.geocoder.cachePath, str);
}

function cleanCache() {
	log.debug('Performing maintenance location cache cleanup');

	let dirty = 0;
	for (const [key, value] of Object.entries(cache)) {
		if (value.retrievedAt > Date.now() - 4 * weekMs) continue;
		delete cache[key];
		dirty += 1;
	}
	if (dirty > 0) {
		log.debug(`Deleted ${dirty} locations from cache`);
		saveLocationCache();
	}
}

export async function rawReverseLookup(lat: number, long: number) {
	try {
		const { body } = await phin<OpenStreetMapResponse>({
			url: `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${long}&zoom=13&format=json&addressdetails=1`,
			method: 'GET',
			parse: 'json',
			headers: {
				'User-Agent': 'everything <git@moonfloof.com>',
			},
		});
		const result = {
			city:
				body.address.city ||
				body.address.town ||
				body.address.village ||
				body.address.suburb ||
				body.address.hamlet,
			state: body.address.state,
			retrievedAt: Date.now(),
		};
		log.debug('Retrieved location from OpenStreetMap:', result);
		return result;
	} catch (err) {
		log.error(err);
		return { retrievedAt: Date.now() };
	}
}

export async function reverseLocation(
	lat: number,
	long: number,
): Promise<{ retrievedAt: number; city?: string; state?: string } | null> {
	if (!config.geocoder.enabled) return null;

	// 1. Use cache if available
	const cacheKey = `${Math.trunc(lat * 100)},${Math.trunc(long * 100)}`;
	if (cache[cacheKey]) return cache[cacheKey];

	try {
		// 2. Lookup cache from OpenStreetMap
		const result = await rawReverseLookup(lat, long);
		cache[cacheKey] = result;
		saveLocationCache();
		return result;
	} catch (err) {
		// 3. Failing that, set the cache anyway, so we don't ask OSM
		//    again for another 4 weeks.
		log.error(err);
		cache[cacheKey] = { retrievedAt: Date.now() };
		saveLocationCache();
		return null;
	}
}
