import { google } from 'googleapis';
import { config } from '../lib/config/index.js';

export async function getYouTubeVideoSnippet(url: string) {
	if (!config.google.apiKey || config.google.apiKey.length === 0) {
		throw new Error(
			'Please provide a YouTube API key using the EVERYTHING_GOOGLE_APIKEY environment variable',
		);
	}

	const videoId = validateYouTubeUrl(url);

	const youtube = google.youtube({
		version: 'v3',
		auth: config.google.apiKey,
	});

	const response = await youtube.videos.list({
		part: ['snippet', 'contentDetails'],
		id: [videoId],
	});

	if (response?.data?.items?.length !== 1 || response?.data?.items?.[0] === undefined) {
		throw new Error(`No results returned for video ID: ${videoId}`);
	}

	const details = response.data.items[0];

	if (!(details.id && details.snippet?.title)) {
		throw new Error('Could not get ID or video title');
	}

	return details;
}

export function validateYouTubeUrl(url: string) {
	const error = new Error('Not a valid YouTube URL');

	const youtubeValidUrls = /(youtube\.com|youtu\.be)/i;
	if (!youtubeValidUrls.test(url)) {
		throw error;
	}

	if (url.includes('youtu.be')) {
		const id = url.match(/youtu\.be\/(?<id>[\w-]{11,})/)?.groups?.id;
		if (!id) {
			throw error;
		}
		return id;
	}

	const id = new URL(url).searchParams.get('v');
	if (id === null || typeof id !== 'string') {
		throw error;
	}

	return id;
}
