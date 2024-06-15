import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { config } from '../lib/config.js';
import Logger from '../lib/logger.js';
import phin from 'phin';

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

export async function rawReverseLookup(lat: number, long: number) {
	if (!config.geocoder.enabled) return null;

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
		};
		log.debug('Retrieved location from OpenStreetMap:', result);
		return result;
	} catch (err) {
		log.error(err);
		return null;
	}
}

export async function reverseLocation(lat: number, long: number) {
	if (!config.geocoder.enabled) return null;

	const cacheKey = `${Math.trunc(lat * 100)},${Math.trunc(long * 100)}`;
	if (cache[cacheKey]) return cache[cacheKey];

	try {
		const result = await rawReverseLookup(lat, long);
		if (result === null) {
			throw new Error(`No results returned for ${lat}, ${long}`);
		}

		cache[cacheKey] = result;
		saveLocationCache();
		return result;
	} catch (err) {
		log.error(err);

		cache[cacheKey] = null;
		saveLocationCache();
		return null;
	}
}
