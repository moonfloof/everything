import { resolve } from 'node:path';
import { environment } from '@moonfloof/stdlib';
import dotenv from 'dotenv';
import type { HelmetOptions } from 'helmet';

dotenv.config();

environment.checkEnvironment({}, [
	'TOMBOIS_SERVER_PORT_EXTERNAL',
	'TOMBOIS_SERVER_PORT_INTERNAL',
	'TOMBOIS_SQLITE_LOCATION',
	'TOMBOIS_DEFAULT_DEVICE_ID',
	'TOMBOIS_SERVER_EXTERNAL_URI',
]);

export const config = {
	versionString: process.env.EVERYTHING_VERSION_STRING || '',
	portExternal: process.env.TOMBOIS_SERVER_PORT_EXTERNAL as string,
	portInternal: process.env.TOMBOIS_SERVER_PORT_INTERNAL as string,
	sqliteLocation: process.env.TOMBOIS_SQLITE_LOCATION as string,
	defaultDeviceId: process.env.TOMBOIS_DEFAULT_DEVICE_ID as string,
	serverExternalUri: process.env.TOMBOIS_SERVER_EXTERNAL_URI as string,
	serverInternalUri: process.env.TOMBOIS_SERVER_INTERNAL_URI as string,
	personName: process.env.TOMBOIS_PERSON_NAME,
	footerHtml: process.env.TOMBOIS_FOOTER_HTML,
	cacheDurationSecs: Number(process.env.TOMBOIS_SERVER_CACHE_DURATION_SECS || 600),
	cacheIntervalSecs: Number(process.env.TOMBOIS_SERVER_CACHE_INTERVAL_SECS || 1200),

	geocoder: {
		enabled: process.env.TOMBOIS_GEOCODER_ENABLED !== 'false',
		cachePath: resolve(process.env.TOMBOIS_GEOCODER_CACHE_PATH || 'data/geocoder.json'),
	},

	discord: {
		token: process.env.TOMBOIS_DISCORD_TOKEN,
		channelId: process.env.TOMBOIS_DISCORD_CHANNELID,
	},

	google: {
		tokenPath: resolve(process.env.TOMBOIS_GOOGLE_TOKENFILE ?? 'data/google-tokens.json'),
		clientId: process.env.TOMBOIS_GOOGLE_CLIENTID,
		clientSecret: process.env.TOMBOIS_GOOGLE_CLIENTSECRET,
		apiKey: process.env.TOMBOIS_GOOGLE_APIKEY,
		youtubePollIntervalMins: Number(process.env.TOMBOIS_GOOGLE_POLL_INTERVAL ?? 5),
		placesApiEnabled: process.env.TOMBOIS_GOOGLE_PLACESAPI_ENABLED === 'true',
		placesApiIgnoredCategories: process.env.TOMBOIS_GOOGLE_PLACESAPI_CATEGORIES_IGNORED?.split(',') ?? [],
	},

	monzo: {
		accountId: process.env.TOMBOIS_MONZO_ACCOUNT_ID,
	},

	letterboxd: {
		dataPath: resolve(process.env.TOMBOIS_LETTERBOXD_DATA_FILE ?? 'data/letterboxd.json'),
		username: process.env.TOMBOIS_LETTERBOXD_USERNAME,
		intervalSecs: Number(process.env.TOMBOIS_LETTERBOXD_POLL_INTERVAL_SECS ?? 86400),
	},

	tmdb: {
		apiBaseUrl: 'https://api.themoviedb.org',
		accessToken: process.env.TOMBOIS_TMDB_ACCESS_TOKEN,
	},

	steam: {
		dataPath: resolve(process.env.TOMBOIS_STEAM_DATA_FILE ?? 'data/steam-activity.json'),
		apiKey: process.env.TOMBOIS_STEAM_APIKEY,
		userId: process.env.TOMBOIS_STEAM_USERID,
		steamDeviceId: process.env.TOMBOIS_STEAM_DEVICE_ID || (process.env.TOMBOIS_DEFAULT_DEVICE_ID as string),
		pollIntervalMinutes: Number(process.env.TOMBOIS_STEAM_POLL_INTERVAL ?? 20),
	},

	psn: {
		dataPath: resolve(process.env.TOMBOIS_PSN_DATA_FILE ?? 'data/psn-activity.json'),
		npsso: process.env.TOMBOIS_PSN_NPSSO,
		deviceId: process.env.TOMBOIS_PSN_DEVICE_ID || (process.env.TOMBOIS_DEFAULT_DEVICE_ID as string),
		pollIntervalMinutes: Number(process.env.TOMBOIS_PSN_POLL_INTERVAL ?? 5),
	},

	retroachievements: {
		apiKey: process.env.TOMBOIS_RETROACHIEVEMENTS_APIKEY,
		username: process.env.TOMBOIS_RETROACHIEVEMENTS_USERNAME,
		pollIntervalMinutes: Number(process.env.TOMBOIS_RETROACHIEVEMENTS_POLL_INTERVAL ?? 20),
		deviceId:
			process.env.TOMBOIS_RETROACHIEVEMENTS_DEVICE_ID ||
			(process.env.TOMBOIS_DEFAULT_DEVICE_ID as string),
	},

	steamgriddb: {
		apiKey: process.env.TOMBOIS_STEAMGRIDDB_APIKEY,
		apiBaseUrl: 'https://www.steamgriddb.com/api/v2',
	},

	bluesky: {
		dataPath: resolve(process.env.TOMBOIS_BLUESKY_DATA_FILE ?? 'data/bluesky.json'),
		username: process.env.TOMBOIS_BLUESKY_USERNAME,
		includeReplies: process.env.TOMBOIS_BLUESKY_INCLUDE_REPLIES === 'true',
		includeReposts: process.env.TOMBOIS_BLUESKY_INCLUDE_REPOSTS === 'true',
		pollInterval: Number(process.env.TOMBOIS_BLUESKY_POLL_INTERVAL_MINS ?? 120),
	},

	sonarr: {
		apiKey: process.env.TOMBOIS_SONARR_APIKEY,
		serverUrl: process.env.TOMBOIS_SONARR_URL,
	},

	subsonic: {
		url: process.env.TOMBOIS_SUBSONIC_URL,
		username: process.env.TOMBOIS_SUBSONIC_USERNAME,
		password: process.env.TOMBOIS_SUBSONIC_PASSWORD,
	},

	location: {
		delayMins: Number(process.env.EVERYTHING_LOCATION_DELAY_MINS || 1440),
		privateLat: Number(process.env.EVERYTHING_LOCATION_PRIVATE_OVERRIDE_LAT || 0),
		privateLong: Number(process.env.EVERYTHING_LOCATION_PRIVATE_OVERRIDE_LONG || 0),
		privateRadius: Number(process.env.EVERYTHING_LOCATION_PRIVATE_OVERRIDE_RADIUS || 0),
		osmBaseUrl: 'https://api.openstreetmap.org/api/0.6/map',
	},

	swarm: {
		oauthClientId: process.env.EVERYTHING_SWARM_CLIENT_ID,
		oauthClientSecret: process.env.EVERYTHING_SWARM_CLIENT_SECRET,
		pushSecret: process.env.EVERYTHING_SWARM_PUSH_SECRET,
		userId: process.env.EVERYTHING_SWARM_USER_ID,
		dataPath: resolve(process.env.EVERYTHING_SWARM_DATA_FILE ?? 'data/swarm.json'),
	},

	kawa: {
		apiBaseUrl: process.env.EVERYTHING_KAWA_SERVER_URL,
		apiKey: process.env.EVERYTHING_KAWA_AUTH_TOKEN,
	},

	helmet: {
		referrerPolicy: {
			policy: ['same-origin'],
		},
	} as HelmetOptions,
} as const;
