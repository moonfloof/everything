import { existsSync } from 'node:fs';
import phin from 'phin';
import { config } from '../lib/config.js';
import Logger from '../lib/logger.js';
import { getImagePath, saveImageToDisk } from '../lib/mediaFiles.js';
import type { ImagesResponse, SearchResponse, TmbdMovieDetails, TmdbImage } from './tmdbTypes.js';

const log = new Logger('tmdb');

async function request<T>(path: string, params?: URLSearchParams): Promise<T> {
	const { accessToken, apiBaseUrl } = config.tmdb;

	if (accessToken === undefined || accessToken.trim() === '') {
		throw new Error('');
	}

	let url = `${apiBaseUrl}${path}`;

	if (params) {
		url += `?${params.toString()}`;
	}

	const response = await phin<T>({
		url,
		method: 'GET',
		parse: 'json',
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'User-Agent': config.versionString,
			Accept: 'application/json',
		},
	});

	if (!response.statusCode || response.statusCode < 200 || response.statusCode > 299) {
		throw new Error(`API Request for '${url}' failed`);
	}

	return response.body;
}

function tmdbImages(id: number, type: 'tv' | 'movie'): Promise<ImagesResponse> {
	return request<ImagesResponse>(`/3/${type}/${id}/images`);
}

function tmbdSearch(query: string, year?: string | number): Promise<SearchResponse> {
	const params = new URLSearchParams({ query });
	if (year) {
		params.append('primary_release_year', `${year}`);
	}

	return request<SearchResponse>('/3/search/movie', params);
}

export function tmdbMovieDetails(id: number): Promise<TmbdMovieDetails> {
	return request<TmbdMovieDetails>(`/3/movie/${id}`);
}

const tmdbGetImageUrl = (path: string) => `https://image.tmdb.org/t/p/original${path}`;

function getPreferredImage(images: TmdbImage[], preferredLanguage?: string): TmdbImage | undefined {
	if (images.length === 0) {
		return undefined;
	}

	if (preferredLanguage !== undefined) {
		const image = images.find(image => image.iso_639_1 === preferredLanguage);
		if (image) return image;
	}

	const nullImage = images.find(image => image.iso_639_1 === null);
	if (nullImage) return nullImage;

	return images[0];
}

export async function searchForImagesById(watchId: string, movieId: number, type: 'tv' | 'movie'): Promise<void> {
	if (config.tmdb.accessToken === '' || config.tmdb.accessToken === undefined) return;

	const heroPath = getImagePath('film', `hero-${watchId}`);
	const posterPath = getImagePath('film', `poster-${watchId}`);
	const heroPathExists = existsSync(heroPath);
	const posterPathExists = existsSync(posterPath);

	if (heroPathExists && posterPathExists) return;

	try {
		log.debug(`Getting images for movie '${movieId}'`);
		const response = await tmdbImages(movieId, type);

		const heroTmdbImage = getPreferredImage(response.backdrops);
		if (!heroPathExists && heroTmdbImage !== undefined) {
			await saveImageToDisk(tmdbGetImageUrl(heroTmdbImage.file_path), heroPath);
		}

		const posterTmdbImage = getPreferredImage(response.posters, 'en');
		if (!posterPathExists && posterTmdbImage !== undefined) {
			await saveImageToDisk(tmdbGetImageUrl(posterTmdbImage.file_path), posterPath);
		}
	} catch (err) {
		log.error((err as Error).message);
		return;
	}
}

/** Only searches for movies, ignores TV shows */
export async function searchForImagesByName(watchId: string, query: string, year?: string | number): Promise<void> {
	if (config.tmdb.accessToken === '' || config.tmdb.accessToken === undefined) return;

	const response = await tmbdSearch(query, year);
	if (response.results.length === 0) {
		log.info(`Couldn't find any results for '${query}'`);
		return;
	}

	const matchingFilm = response.results.find(film => film.title.toLowerCase() === query.toLowerCase());
	if (!matchingFilm) {
		log.info(`Couldn't find a match for '${query}' - is the name correct?`);
		return;
	}

	return searchForImagesById(watchId, matchingFilm.id, 'movie');
}
