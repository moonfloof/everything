import { existsSync } from 'node:fs';
import phin from 'phin';
import type { Game } from '../database/game.js';
import { config } from '../lib/config.js';
import Logger from '../lib/logger.js';
import { getImagePath, saveImageToDisk } from '../lib/mediaFiles.js';
import { saveImages } from './steam.js';
import type { GridsQuery, HeroesQuery, ImageResponse, SearchAutocompleteResponse } from './steamgriddbTypes.js';

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

	const heroImagePath = getImagePath('game', `hero-${game.id}`);
	const libraryImagePath = getImagePath('game', `library-${game.id}`);

	if (existsSync(heroImagePath) && existsSync(libraryImagePath)) return;

	log.debug(`Searching images for '${term}'`);
	const search = await searchAutocomplete(term);
	if (search.data.length === 0) return;
	const searchGame = search.data[0];

	if (!existsSync(heroImagePath)) {
		log.debug(`Fetching hero image for '${term}'`);
		const heroes = await heroesForGame(searchGame.id, { dimensions: '1920x620' });
		if (heroes.data.length > 0) {
			const heroImageUrl = heroes.data[0].url;
			saveImageToDisk(heroImageUrl, heroImagePath);
		}
	}

	if (!existsSync(libraryImagePath)) {
		log.debug(`Fetching library image for '${term}'`);
		const grids = await gridsForGame(searchGame.id, { dimensions: '600x900' });
		if (grids.data.length > 0) {
			const libraryImageUrl = grids.data[0].url;
			saveImageToDisk(libraryImageUrl, libraryImagePath);
		}
	}
}
