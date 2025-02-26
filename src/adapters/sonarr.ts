import dotenv from 'dotenv';
import phin from 'phin';
import { config } from '../lib/config.js';
import type { Episode, EpisodeWithSeries, Series } from './sonarrTypes.js';

dotenv.config();

const api = <T = unknown>(path: string, params: { seriesId?: string } = {}) => {
	if (!(config.sonarr.apiKey && config.sonarr.serverUrl)) {
		throw new Error('Please provide a Sonarr API key and URL to use this functionality');
	}

	const paramString = new URLSearchParams({
		apiKey: config.sonarr.apiKey,
		...params,
	}).toString();

	return phin<T>({
		url: new URL(`${path}?${paramString}`, config.sonarr.serverUrl),
		parse: 'json',
	});
};

export const getSeriesList = async () => {
	const response = await api<Series[]>('/api/v3/series');

	return response.body.map(series => ({
		title: `${series.title} (${series.year})`,
		id: series.id,
	}));
};

export const getSeries = async (seriesId: number) => {
	const response = await api<Series>(`/api/v3/series/${seriesId}`);
	return response.body;
};

export const getEpisodeList = async (seriesId: string) => {
	const response = await api<Episode[]>('/api/v3/episode', { seriesId });

	return response.body.map(episode => ({
		title: `S${episode.seasonNumber}E${episode.episodeNumber} - ${episode.title}`,
		id: episode.id,
	}));
};

export const getEpisode = async (episodeId: string) => {
	const response = await api<EpisodeWithSeries>(`/api/v3/episode/${episodeId}`);
	return response.body;
};
