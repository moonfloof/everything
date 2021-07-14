import fs from 'fs';
import path from 'path';
// eslint-disable-next-line no-unused-vars
import { google, Auth } from 'googleapis';
import { insertYouTubeLike } from '../database/youtubelikes.js';

let client = null;
let accessToken = null;
let refreshToken = null;
let youtubeLikes = [];

const storagePath = path.resolve('tokens.json');

/**
 * @return {Auth.OAuth2Client}
 */
const getClient = () => {
	if (client !== null) return client;

	client = new google.auth.OAuth2({
		clientId: process.env.TOMBOIS_GOOGLE_CLIENTID,
		clientSecret: process.env.TOMBOIS_GOOGLE_CLIENTSECRET,
		redirectUri: process.env.TOMBOIS_GOOGLE_REDIRECTURI,
	});

	client.on('tokens', tokens => {
		accessToken = tokens.access_token;
		refreshToken = tokens.refresh_token;
		saveTokensToDisk();
		google.options({ auth: client });
	});

	return client;
};

export const generateAuthUrl = () => {
	return getClient().generateAuthUrl({
		access_type: 'offline',
		scope: [
			'https://www.googleapis.com/auth/youtube.readonly',
		],
	});
};

export const loadTokensFromDisk = () => {
	if (fs.existsSync(storagePath) === false) {
		accessToken = null;
		refreshToken = null;
		youtubeLikes = [];
		return;
	}

	const contents = JSON.parse(fs.readFileSync(storagePath).toString());

	accessToken = contents.accessToken;
	refreshToken = contents.refreshToken;
	youtubeLikes = contents.youtubeLikes || [];

	getClient().setCredentials({
		access_token: contents.accessToken,
		refresh_token: contents.refreshToken,
	});
	google.options({ auth: getClient() });
};

const saveTokensToDisk = () => {
	const str = JSON.stringify({ accessToken, refreshToken, youtubeLikes }, null, 2);
	fs.writeFileSync(storagePath, str);
};

export const retrieveAccessToken = async (authCode) => {
	const { tokens } = await getClient().getToken(authCode);

	accessToken = tokens.access_token;
	refreshToken = tokens.refresh_token;
	saveTokensToDisk();

	getClient().setCredentials(tokens);
	google.options({ auth: getClient() });
};

export const pollForLikedVideos = () => {
	const fetchVideos = async () => {
		try {
			if (accessToken === null) return;

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

			for (let i = newVideos.length - 1; i >= 0; i--) {
				const video = newVideos[i];
				const url = `https://www.youtube.com/watch?v=${video.id}`;

				await insertYouTubeLike(
					url,
					video.snippet.title,
					video.snippet.channelTitle,

					// FIXME: Remove hard coded device ID
					'2a57071e-6aea-4ac1-8fb1-bda70ebf76f1',
				);
			}

			youtubeLikes = data.items.map(v => v.id);
			saveTokensToDisk();
		} catch (err) {
			console.error(err);
		}
	};

	setInterval(fetchVideos, 60 * 1000);
	fetchVideos();
};
