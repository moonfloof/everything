import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { type OAuth2Client, gaxios } from 'google-auth-library';
import { google } from 'googleapis';
import { insertYouTubeLike } from '../database/youtubelikes.js';
import { config } from '../lib/config.js';
import { minuteMs } from '../lib/formatDate.js';
import Logger from '../lib/logger.js';

const log = new Logger('YouTube');

let client: OAuth2Client;
interface GoogleAuth {
	accessToken?: string | null;
	refreshToken?: string | null;
	accessTokenExpiryDate?: number | null;
}
let googleAuth: GoogleAuth = {
	accessToken: null,
	refreshToken: null,
	accessTokenExpiryDate: null,
};
let youtubeLikes: string[] = [];

function getClient() {
	if (client !== null) return client;

	client = new google.auth.OAuth2({
		clientId: config.youtube.clientId,
		clientSecret: config.youtube.clientSecret,
		redirectUri: `${config.serverExternalUri}/api/youtube/callback`,
	});

	client.on('tokens', tokens => {
		log.info('Retrieved tokens, updating cache.');
		googleAuth.accessToken = tokens.access_token;
		googleAuth.refreshToken = tokens.refresh_token;
		saveTokensToDisk();

		client.setCredentials(tokens);
		google.options({ auth: client });
	});

	return client;
}

export function generateAuthUrl() {
	log.info('Generating auth URL');
	return getClient().generateAuthUrl({
		access_type: 'offline',
		scope: ['https://www.googleapis.com/auth/youtube.readonly'],
	});
}

function loadTokensFromDisk() {
	log.info('Loading tokens and cache data from disk');
	if (existsSync(config.youtube.tokenPath) === false) {
		log.debug('Token file does not exist, providing defaults');
		googleAuth.accessToken = null;
		googleAuth.refreshToken = null;
		googleAuth.accessTokenExpiryDate = null;
		youtubeLikes = [];
		return;
	}

	const contents = JSON.parse(readFileSync(config.youtube.tokenPath).toString());

	googleAuth = contents.googleAuth;
	youtubeLikes = contents.youtubeLikes || [];

	log.debug('Setting client credentials');
	getClient().setCredentials({
		access_token: googleAuth.accessToken,
		refresh_token: googleAuth.refreshToken,
	});
	google.options({ auth: getClient() });
}

function saveTokensToDisk() {
	log.info('Saving tokens and cache data to disk');
	const str = JSON.stringify({ googleAuth, youtubeLikes }, null, 2);
	writeFileSync(config.youtube.tokenPath, str);
}

export async function retrieveAccessToken(authCode: string) {
	log.info('Fetching access token based on auth code');
	const { tokens } = await getClient().getToken(authCode);

	googleAuth.accessToken = tokens.access_token;
	googleAuth.refreshToken = tokens.refresh_token;
	googleAuth.accessTokenExpiryDate = tokens.expiry_date;

	saveTokensToDisk();

	getClient().setCredentials(tokens);
	google.options({ auth: getClient() });
}

async function getLatestLikedVideos() {
	if (!(googleAuth.accessToken && googleAuth.accessTokenExpiryDate)) {
		log.debug('No token provided, skipping.');
		return [];
	}

	if (googleAuth.accessTokenExpiryDate < Date.now()) {
		log.info('Access token has expired. Using refresh token.');
	}

	const youtube = google.youtube('v3');
	const { data } = await youtube.videos.list({
		part: ['snippet'],
		maxResults: 10,
		myRating: 'like',
	});

	return data.items || [];
}

export function pollForLikedVideos() {
	const intervalMs = config.youtube.pollInterval * minuteMs;

	if (intervalMs === 0) {
		log.warn('Polling is disabled, liked videos will not be automatically tracked');
		return;
	}

	loadTokensFromDisk();

	const fetchVideos = async () => {
		log.info('Polling YouTube for liked videos');
		try {
			const items = await getLatestLikedVideos();
			const newVideos = items.filter(item => !youtubeLikes.find(id => item.id === id));
			newVideos.reverse();

			if (newVideos.length === 0) return;

			log.debug(`Found ${newVideos.length} new videos`);

			for (const video of newVideos) {
				if (!(video.id && video.snippet?.title && video.snippet?.channelTitle)) {
					continue;
				}

				insertYouTubeLike({
					video_id: video.id,
					title: video.snippet.title,
					channel: video.snippet.channelTitle,
					device_id: config.defaultDeviceId,
					created_at: '',
				});
			}

			youtubeLikes = items.map(v => v.id || '');
			saveTokensToDisk();
		} catch (err) {
			console.error(err);
			if (err instanceof gaxios.GaxiosError && err.code === '401') {
				googleAuth.accessToken = null;
				googleAuth.accessTokenExpiryDate = null;
				googleAuth.refreshToken = null;
				saveTokensToDisk();
			}
		}
	};

	setInterval(fetchVideos, intervalMs);
}

export async function getYouTubeVideoSnippet(url: string) {
	if (!config.youtube.apiKey || config.youtube.apiKey.length === 0) {
		throw new Error(
			'Please provide a YouTube API key using the TOMBOIS_GOOGLE_APIKEY environment variable',
		);
	}

	const videoId = validateYouTubeUrl(url);

	const youtube = google.youtube({
		version: 'v3',
		auth: config.youtube.apiKey,
	});

	const response = await youtube.videos.list({
		part: ['snippet'],
		id: [videoId],
	});

	if (response?.data?.items?.length !== 1) {
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
