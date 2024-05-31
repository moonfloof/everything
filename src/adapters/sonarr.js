import dotenv from 'dotenv';
import phin from 'phin';

dotenv.config();

const api = (path, params = {}) => {
	const paramString = new URLSearchParams({
		apiKey: process.env.TOMBOIS_SONARR_APIKEY,
		...params,
	});

	return phin({
		url: new URL(`${path}?${paramString}`, process.env.TOMBOIS_SONARR_URL),
		parse: 'json',
	});
};

export const getSeriesList = async () => {
	const response = await api('/api/v3/series');

	return response.body.map(series => ({
		title: `${series.title} (${series.year})`,
		id: series.id,
	}));
};

export const getSeries = async seriesId => {
	const response = await api(`/api/v3/series/${seriesId}`);
	return response.body;
};

export const getEpisodeList = async seriesId => {
	const response = await api('/api/v3/episode', { seriesId });

	return response.body.map(episode => ({
		title: `S${episode.seasonNumber}E${episode.episodeNumber} - ${episode.title}`,
		id: episode.id,
	}));
};

export const getEpisode = async episodeId => {
	const response = await api(`/api/v3/episode/${episodeId}`);
	return response.body;
};
