import { existsSync, writeFileSync } from 'node:fs';
import phin from 'phin';
import { config } from '../lib/config.js';
import Logger from '../lib/logger.js';
import type { SearchAutocompleteResponse, ImageResponse, HeroesQuery, GridsQuery } from './steamgriddbTypes.js';
import type { Game } from '../database/game.js';
import { saveImages } from './steam.js';

const log = new Logger('steamgriddb');

function paramsToQueryString(params: Record<string, string | number | boolean>) {
	const qs = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		qs.append(key, `${value}`);
	}

	return qs;
}

async function request<T>(url: string, params?: Record<string, string | number | boolean>): Promise<T> {
	const { apiKey, apiBaseUrl } = config.steamgriddb;

	if (!(apiKey && apiBaseUrl)) {
		throw new Error('Both API_KEY and BASE_URL must be provided');
	}

	let formedUrl = `${apiBaseUrl}${url}`;

	if (params) {
		formedUrl += `?${paramsToQueryString(params).toString()}`;
	}

	const response = await phin<T>({
		url: formedUrl,
		method: 'GET',
		parse: 'json',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'User-Agent': config.versionString,
		},
	});

	if (!response.statusCode || response.statusCode < 200 || response.statusCode > 299) {
		throw new Error(`API Request for '${url}' failed`);
	}

	return response.body;
}

const getImagePath = (path: string) => `public/game-images/${path}`;
export const imageExists = (path: string) => existsSync(getImagePath(path));

export async function saveImageToDisk(url: string, path: string) {
	if (imageExists(path)) return;

	const response = await phin({
		method: 'GET',
		headers: {
			'User-Agent': config.versionString,
		},
		url,
		parse: 'none',
	});

	if (!response.statusCode || response.statusCode < 200 || response.statusCode > 299) return;
	if (response.errored !== null) return;

	log.info(`Saving '${path}' (${Math.round(response.body.byteLength / 1024)} kB)`);
	writeFileSync(getImagePath(path), response.body);
}

function searchAutocomplete(term: string) {
	const url = `/search/autocomplete/${term}`;
	return request<SearchAutocompleteResponse>(url);
}

function heroesForGame(game_id: number, params?: HeroesQuery) {
	const url = `/heroes/game/${game_id}`;
	return request<ImageResponse>(url, params);
}

function gridsForGame(game_id: number, params?: GridsQuery) {
	const url = `/grids/game/${game_id}`;
	return request<ImageResponse>(url, params);
}

export async function searchForImages(term: string, game: Game) {
	if (game.url?.includes('store.steampowered.com')) {
		const appid = game.url.match(/store\.steampowered\.com\/app\/([0-9]+)/)?.[1];
		if (!appid) return;
		await saveImages(Number(appid), game.id);
		return;
	}

	if (!config.steamgriddb.apiBaseUrl) return;

	const heroImagePath = `hero-${game.id}.jpg`;
	const libraryImagePath = `library-${game.id}.jpg`;

	if (imageExists(heroImagePath) && imageExists(libraryImagePath)) return;

	log.debug(`Searching images for '${term}'`);
	const search = await searchAutocomplete(term);
	if (!search.success || search.data.length === 0) return;
	const searchGame = search.data[0];

	if (!imageExists(heroImagePath)) {
		log.debug(`Fetching hero image for '${term}'`);
		const heroes = await heroesForGame(searchGame.id, { dimensions: '1920x620' });
		if (heroes.success && heroes.data.length > 0) {
			const heroImageUrl = heroes.data[0].url;
			saveImageToDisk(heroImageUrl, heroImagePath);
		}
	}

	if (!imageExists(libraryImagePath)) {
		log.debug(`Fetching library image for '${term}'`);
		const grids = await gridsForGame(searchGame.id, { dimensions: '600x900' });
		if (grids.success && grids.data.length > 0) {
			const libraryImageUrl = grids.data[0].url;
			saveImageToDisk(libraryImageUrl, libraryImagePath);
		}
	}
}
