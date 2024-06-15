import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import NodeGeocoder from 'node-geocoder';
import { config } from '../lib/config.js';
import Logger from '../lib/logger.js';

const log = new Logger('geocoder');

let geocoder: NodeGeocoder.Geocoder;

let cache: Record<string, { city?: string; state?: string } | null> = {};

export function initLocationCache() {
	if (!config.geocoder.enabled) return;

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

export function getGeocoder() {
	if (!config.geocoder.enabled) return null;
	if (geocoder) return geocoder;

	geocoder = NodeGeocoder({
		provider: 'openstreetmap',
	});

	return geocoder;
}

export async function reverseLocation(lat: number, lon: number) {
	if (!config.geocoder.enabled) return null;

	const cacheKey = `${Math.trunc(lat * 100)},${Math.trunc(lon * 100)}`;
	if (cache[cacheKey]) return cache[cacheKey];

	try {
		const results = (await getGeocoder()?.reverse({ lat, lon })) || [];
		if (results.length === 0) {
			throw new Error('No results returned');
		}

		cache[cacheKey] = {
			city: results[0].city,
			state: results[0].state,
		};
		saveLocationCache();
		return results[0];
	} catch (err) {
		log.error(err);

		cache[cacheKey] = null;
		saveLocationCache();
		return null;
	}
}
