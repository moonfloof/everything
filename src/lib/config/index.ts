import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { environment } from '@moonfloof/stdlib';
import type { Config } from './config.js';
import { parseConfigValue, parseIntervalToCron } from './parseConfigValue.js';

loadEnvFile();

environment.checkEnvironment({}, [
	'EVERYTHING_SERVER_PORT_EXTERNAL',
	'EVERYTHING_SERVER_PORT_INTERNAL',
	'EVERYTHING_SERVER_EXTERNAL_URI',
	'EVERYTHING_SERVER_INTERNAL_URI',

	// Accessed directly by the database setup in `lib/database/database.ts`
	'EVERYTHING_SQLITE_LOCATION',
]);

export let config: Config;

export function initConfig() {
	config = {
		// These variables will *require* environment variables
		portExternal: process.env.EVERYTHING_SERVER_PORT_EXTERNAL as string,
		portInternal: process.env.EVERYTHING_SERVER_PORT_INTERNAL as string,
		serverExternalUri: process.env.EVERYTHING_SERVER_EXTERNAL_URI as string,
		serverInternalUri: process.env.EVERYTHING_SERVER_INTERNAL_URI as string,

		// The remaining variables can be parsed via the database.
		versionString: parseConfigValue('version_string', 'string', '', false),
		defaultDeviceId: parseConfigValue('default_device_id', 'string', '', false),
		personName: parseConfigValue('person_name', 'string', 'Your Name', false),
		cacheDurationSecs: parseConfigValue('server_cache_duration_secs', 'number', 600, false),
		cacheClearCron: parseIntervalToCron(
			'server_cache_clear_cron',
			'EVERYTHING_SERVER_CACHE_INTERVAL_SECS',
			's',
		),

		geocoder: {
			cachePath: resolve(process.env.EVERYTHING_GEOCODER_CACHE_PATH || 'data/geocoder.json'),
			enabled: parseConfigValue('geocoder_enabled', 'bool', true, false),
		},

		discord: {
			token: parseConfigValue('discord_token', 'string', null, true),
			channelId: parseConfigValue('discord_channelid', 'string', null, true),
		},

		google: {
			apiKey: parseConfigValue('google_apikey', 'string', null, true),
			placesApiEnabled: parseConfigValue('google_placesapi_enabled', 'bool', false, false),
			placesApiIgnoredCategories: parseConfigValue(
				'google_placesapi_categories_ignored',
				'string',
				'bus_stop,bus_station,transit_station,atm',
				false,
			).split(','),
		},

		letterboxd: {
			dataPath: resolve(process.env.EVERYTHING_LETTERBOXD_DATA_FILE ?? 'data/letterboxd.json'),
			username: parseConfigValue('letterboxd_username', 'string', null, true),
			pollCron: parseIntervalToCron(
				'letterboxd_poll_cron',
				'EVERYTHING_LETTERBOXD_POLL_INTERVAL_SECS',
				's',
			),
		},

		tmdb: {
			apiBaseUrl: 'https://api.themoviedb.org',
			accessToken: parseConfigValue('tmdb_access_token', 'string', null, true),
		},

		steam: {
			dataPath: resolve(process.env.EVERYTHING_STEAM_DATA_FILE ?? 'data/steam-activity.json'),
			apiKey: parseConfigValue('steam_apikey', 'string', null, true),
			userId: parseConfigValue('steam_userid', 'string', null, true),
			deviceId: parseConfigValue('steam_device_id', 'string', null, true),

			// This won't be converted to a cron schedule due to the adapter
			// using the interval time to calculate play time.
			pollIntervalMinutes: parseConfigValue('steam_poll_interval_mins', 'number', 0, false),
		},

		psn: {
			dataPath: resolve(process.env.EVERYTHING_PSN_DATA_FILE ?? 'data/psn-activity.json'),
			npsso: parseConfigValue('psn_npsso', 'string', null, true),
			deviceId: parseConfigValue('psn_device_id', 'string', null, true),

			// This won't be converted to a cron schedule due to the adapter
			// using the interval time to calculate play time.
			pollIntervalMinutes: parseConfigValue('psn_poll_interval_mins', 'number', 0, false),
		},

		retroachievements: {
			apiKey: parseConfigValue('retroachievements_apikey', 'string', null, true),
			username: parseConfigValue('retroachievements_username', 'string', null, true),
			deviceId: parseConfigValue('retroachievements_device_id', 'string', null, true),

			// This won't be converted to a cron schedule due to the adapter
			// using the interval time to calculate play time.
			pollIntervalMinutes: parseConfigValue(
				'retroachievements_poll_interval_mins',
				'number',
				0,
				false,
			),
		},

		steamgriddb: {
			apiBaseUrl: 'https://www.steamgriddb.com/api/v2',
			apiKey: parseConfigValue('steamgriddb_apikey', 'string', null, true),
		},

		bluesky: {
			dataPath: resolve(process.env.EVERYTHING_BLUESKY_DATA_FILE ?? 'data/bluesky.json'),
			username: parseConfigValue('bluesky_username', 'string', null, true),
			includeReplies: parseConfigValue('bluesky_include_replies', 'bool', false, false),
			includeReposts: parseConfigValue('bluesky_include_reposts', 'bool', false, false),
			pollCron: parseIntervalToCron(
				'bluesky_poll_cron',
				'EVERYTHING_BLUESKY_POLL_INTERVAL_MINS',
				'm',
			),
		},

		sonarr: {
			apiKey: parseConfigValue('sonarr_apikey', 'string', null, true),
			serverUrl: parseConfigValue('sonarr_url', 'string', null, true),
		},

		subsonic: {
			url: parseConfigValue('subsonic_url', 'string', null, true),
			username: parseConfigValue('subsonic_username', 'string', null, true),
			password: parseConfigValue('subsonic_password', 'string', null, true),
		},

		location: {
			osmBaseUrl: 'https://api.openstreetmap.org/api/0.6/map',
			dashboardDisplay: parseConfigValue('location_display', 'bool', false, false),
			delayMins: parseConfigValue('location_delay_mins', 'number', 1440, false),
			privateLat: parseConfigValue('location_private_override_lat', 'number', 0, false),
			privateLong: parseConfigValue('location_private_override_long', 'number', 0, false),
			privateRadius: parseConfigValue('location_private_override_radius', 'number', 0.01, false),
		},

		swarm: {
			dataPath: resolve(process.env.EVERYTHING_SWARM_DATA_FILE ?? 'data/swarm.json'),
			oauthClientId: parseConfigValue('swarm_client_id', 'string', null, true),
			oauthClientSecret: parseConfigValue('swarm_client_secret', 'string', null, true),
			pushSecret: parseConfigValue('swarm_push_secret', 'string', null, true),
			userId: parseConfigValue('swarm_user_id', 'string', null, true),
		},

		kawa: {
			apiBaseUrl: parseConfigValue('kawa_server_url', 'string', null, true),
			apiKey: parseConfigValue('kawa_auth_token', 'string', null, true),
		},
	} as const;
}

export default function getConfig() {
	if (!config) {
		throw new Error(
			'Please initialise the config by calling `initConfig()` at the start of the application',
		);
	}

	return config;
}
