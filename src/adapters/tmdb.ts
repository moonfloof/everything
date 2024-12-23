import { existsSync } from 'node:fs';
import { config } from '../lib/config.js';
import { getImagePath, saveImageToDisk } from '../lib/mediaFiles.js';
import phin from 'phin';
import Logger from '../lib/logger.js';

const log = new Logger('tmdb');

type TmdbImage = {
	file_path: string;
	iso_639_1: string | null;

	vote_average: number;
	vote_count: number;

	aspect_ratio: number;
	width: number;
	height: number;
};

type ImagesResponse = {
	id: number;
	backdrops: TmdbImage[];
	logos: TmdbImage[];
	posters: TmdbImage[];
};

type SearchResponse = {
	page: number;
	results: {
		adult: boolean;
		backdrop_path: string;
		genre_ids: number[];
		id: number;
		original_language: string;
		original_title: string;
		overview: string;
		popularity: string;
		poster_path: string;
		release_date: string;
		title: string;
		video: boolean;
		vote_average: number;
		vote_count: number;
	}[];
	total_pages: number;
	total_results: number;
};

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

const tmdbGetImageUrl = (path: string) => `https://image.tmdb.org/t/p/original${path}`;

function getEnImageOrDefault(images: TmdbImage[]): TmdbImage {
	const en = images.find(image => image.iso_639_1 === 'en');
	if (en) return en;

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

		if (!heroPathExists && response.backdrops.length > 0) {
			await saveImageToDisk(
				tmdbGetImageUrl(getEnImageOrDefault(response.backdrops).file_path),
				heroPath,
			);
		}

		if (!posterPathExists && response.posters.length > 0) {
			await saveImageToDisk(
				tmdbGetImageUrl(getEnImageOrDefault(response.posters).file_path),
				posterPath,
			);
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
