import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { insertYouTubeLike } from '../database/youtubelikes.js';
import Logger from '../lib/logger.js';
import { minuteMs } from '../lib/formatDate.js';

const log = new Logger('YouTube');

let client = null;
let googleAuth = {
	accessToken: null,
	refreshToken: null,
	accessTokenExpiryDate: null,
};
let youtubeLikes = [];

const storagePath = () => path.resolve(process.env.TOMBOIS_GOOGLE_TOKENFILE);

/**
 * @return {import('googleapis').Auth.OAuth2Client}
 */
const getClient = () => {
	if (client !== null) return client;

	client = new google.auth.OAuth2({
		clientId: process.env.TOMBOIS_GOOGLE_CLIENTID,
		clientSecret: process.env.TOMBOIS_GOOGLE_CLIENTSECRET,
		redirectUri: process.env.TOMBOIS_SERVER_EXTERNAL_URI + '/api/youtube/callback',
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
};

export const generateAuthUrl = () => {
	log.info('Generating auth URL');
	return getClient().generateAuthUrl({
		access_type: 'offline',
		scope: [
			'https://www.googleapis.com/auth/youtube.readonly',
		],
	});
};

const loadTokensFromDisk = () => {
	log.info('Loading tokens and cache data from disk');
	if (fs.existsSync(storagePath()) === false) {
		log.debug('Token file does not exist, providing defaults');
		googleAuth.accessToken = null;
		googleAuth.refreshToken = null;
		googleAuth.accessTokenExpiryDate = null;
		youtubeLikes = [];
		return;
	}

	const contents = JSON.parse(fs.readFileSync(storagePath()).toString());

	googleAuth = contents.googleAuth;
	youtubeLikes = contents.youtubeLikes || [];

	log.debug('Setting client credentials');
	getClient().setCredentials({
		access_token: googleAuth.accessToken,
		refresh_token: googleAuth.refreshToken,
	});
	google.options({ auth: getClient() });
};

const saveTokensToDisk = () => {
	log.info('Saving tokens and cache data to disk');
	const str = JSON.stringify({ googleAuth, youtubeLikes }, null, 2);
	fs.writeFileSync(storagePath(), str);
};

export const retrieveAccessToken = async (authCode) => {
	log.info('Fetching access token based on auth code');
	const { tokens } = await getClient().getToken(authCode);

	googleAuth.accessToken = tokens.access_token;
	googleAuth.refreshToken = tokens.refresh_token;
	googleAuth.accessTokenExpiryDate = tokens.expiry_date;

	saveTokensToDisk();

	getClient().setCredentials(tokens);
	google.options({ auth: getClient() });
};

export const pollForLikedVideos = () => {
	const intervalMins = Number(process.env.TOMBOIS_GOOGLE_POLL_INTERVAL) ?? 5;
	const intervalMs = intervalMins * minuteMs;

	if (intervalMs === 0) return;

	loadTokensFromDisk();

	const fetchVideos = async () => {
		log.info('Polling YouTube for liked videos');
		try {
			if (googleAuth.accessToken === null) {
				log.debug('No token provided, skipping.');
				return;
			}

			if (googleAuth.accessTokenExpiryDate < Date.now()) {
				log.info('Access token has expired. Using refresh token.');
			}

			const youtube = google.youtube('v3');
			const { data } = await youtube.videos.list({
				part: [ 'snippet' ],
				maxResults: 10,
				myRating: 'like',
			});

			const newVideos = data.items.filter(item => (
				!youtubeLikes.find(id => item.id === id)
			));

			if (newVideos.length === 0) {
				return;
			}

			log.debug(`Found ${newVideos.length} new videos`);

			for (let i = newVideos.length - 1; i >= 0; i--) {
				const video = newVideos[i];
				const url = `https://www.youtube.com/watch?v=${video.id}`;

				insertYouTubeLike(
					url,
					video.snippet.title,
					video.snippet.channelTitle,
					process.env.TOMBOIS_DEFAULT_DEVICE_ID,
				);
			}

			youtubeLikes = data.items.map(v => v.id);
			saveTokensToDisk();
		} catch (err) {
			console.error(err);
			if (err.code === 401) {
				googleAuth.accessToken = null;
				googleAuth.accessTokenExpiryDate = null;
				googleAuth.refreshToken = null;
				saveTokensToDisk();
			}
		}
	};

	setInterval(fetchVideos, intervalMs);
};

export const getYouTubeVideoSnippet = async (url) => {
	const auth = process.env.TOMBOIS_GOOGLE_APIKEY;

	if (auth === undefined || auth.length === 0) {
		return {};
	}

	const videoId = new URL(url).searchParams.get('v');
	if (videoId === null || typeof videoId !== 'string') {
		throw new Error('Not a valid YouTube URL');
	}

	const youtube = google.youtube({
		version: 'v3',
		auth,
	});

	const response = await youtube.videos.list({
		part: [ 'snippet' ],
		id: [ videoId ],
	});

	if (response?.data?.items?.length !== 1) {
		throw new Error(`No results returned for video ID: ${videoId}`);
	}

	return response.data.items[0];
};
