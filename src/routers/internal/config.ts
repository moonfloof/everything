import express from 'express';
import { pollForBlueskyPosts } from '../../adapters/bluesky.js';
import { getDiscordClient } from '../../adapters/discord.js';
import { pollForFilmActivity } from '../../adapters/letterboxd.js';
import { authenticateApi, clearAuthentication, getAuthentication, pollForPsnActivity } from '../../adapters/psn.js';
import { pollForRetroAchievementsActivity } from '../../adapters/retroachievements.js';
import { pollForGameActivity } from '../../adapters/steam.js';
import { setConfigValue } from '../../database/config.js';
import { addNewDevice, getDevicesWithApiKeys, updateDevice } from '../../database/devices.js';
import { getJobs } from '../../lib/config/cron.js';
import { config } from '../../lib/config/index.js';
import convertPollIntervalToCron from '../../lib/config/pollIntervalToCron.js';
import { pageCache } from '../../lib/middleware/cachePage.js';
import type { RequestFrontend } from '../../types/express.js';

const router = express.Router();

// FRONTEND

router.get('/', (_req: RequestFrontend, res) => {
	const devices = getDevicesWithApiKeys();
	const jobs = getJobs();
	const psnAuthentication = getAuthentication();
	res.render('internal/config', { config, devices, jobs, psnAuthentication });
});

// CRUD

interface DevicePostBody {
	deviceDescription: string;
	deviceApiKey: string;
}

router.post('/device', (req: RequestFrontend<object, DevicePostBody>, res) => {
	const description = req.body.deviceDescription;
	const apiKey = req.body.deviceApiKey;

	addNewDevice(description, apiKey);

	res.redirect('/config#devices');
});

interface DeviceUpdateBody {
	deviceDescription: string;
	deviceApiKey: string;
}

router.post('/device/:deviceId', (req: RequestFrontend<object, DeviceUpdateBody>, res) => {
	const id = req.params.deviceId;
	const description = req.body.deviceDescription;
	const apiKey = req.body.deviceApiKey;

	updateDevice(id, description, apiKey);

	res.redirect('/config#devices');
});

interface ServerBody {
	personName: string;
	versionString: string;
	defaultDeviceId: string;
	serverCacheEnable?: string;
}

router.post('/server', (req: RequestFrontend<object, ServerBody>, res) => {
	const cacheEnabled = req.body.serverCacheEnable !== undefined;
	const cacheDurationSecs = cacheEnabled ? 1200 : 0;
	const cacheClearCron = cacheEnabled ? convertPollIntervalToCron(20) : null;

	setConfigValue('person_name', req.body.personName);
	setConfigValue('version_string', req.body.versionString || null);
	setConfigValue('default_device_id', req.body.defaultDeviceId);
	setConfigValue('server_cache_duration_secs', `${cacheDurationSecs}`);
	setConfigValue('server_cache_clear_cron', cacheClearCron);

	config.personName = req.body.personName;
	config.versionString = req.body.versionString || null;
	config.defaultDeviceId = req.body.defaultDeviceId;
	config.cacheDurationSecs = cacheDurationSecs;
	config.cacheClearCron = cacheClearCron;

	pageCache.pollForCacheDeletion();

	res.redirect('/config#server');
});

interface LocationBody {
	enableGeocoder?: string;
	dashboardDisplay?: string;
	delayMins: string;
	privateLat: string;
	privateLong: string;
	privateRadius: string;
}

router.post('/location', (req: RequestFrontend<object, LocationBody>, res) => {
	const enableGeocoder = req.body.enableGeocoder !== undefined;
	const dashboardDisplay = req.body.dashboardDisplay !== undefined;
	const delayMins = Number(req.body.delayMins || 0);
	const privateLat = Number(req.body.privateLat || 0);
	const privateLong = Number(req.body.privateLong || 0);
	const privateRadius = Number(req.body.privateRadius || 0);

	if (
		Number.isNaN(delayMins) ||
		Number.isNaN(privateLat) ||
		Number.isNaN(privateLong) ||
		Number.isNaN(privateRadius)
	) {
		return res.redirect('/config#location');
	}

	setConfigValue('geocoder_enabled', enableGeocoder ? 'true' : 'false');
	setConfigValue('location_display', dashboardDisplay ? 'true' : 'false');
	setConfigValue('location_delay_mins', req.body.delayMins);
	setConfigValue('location_private_override_lat', req.body.privateLat);
	setConfigValue('location_private_override_long', req.body.privateLong);
	setConfigValue('location_private_override_radius', req.body.privateRadius);

	config.geocoder.enabled = enableGeocoder;
	config.location.dashboardDisplay = dashboardDisplay;
	config.location.delayMins = delayMins;
	config.location.privateLat = privateLat;
	config.location.privateLong = privateLong;
	config.location.privateRadius = privateRadius;

	res.redirect('/config#location');
});

interface SteamBody {
	steamEnabled?: string;
	steamApiKey: string;
	steamUserId: string;
	steamDeviceId: string;
}

router.post('/steam', (req: RequestFrontend<object, SteamBody>, res) => {
	const steamEnabled = req.body.steamEnabled !== undefined;
	const steamApiKey = req.body.steamApiKey || null;
	const steamDeviceId = req.body.steamDeviceId || null;
	const steamUserId = req.body.steamUserId || null;

	setConfigValue('steam_poll_interval_mins', steamEnabled ? '20' : '0');
	setConfigValue('steam_apikey', steamApiKey);
	setConfigValue('steam_device_id', steamDeviceId);
	setConfigValue('steam_userid', steamUserId);

	config.steam.apiKey = steamApiKey;
	config.steam.deviceId = steamDeviceId;
	config.steam.pollIntervalMinutes = steamEnabled ? 20 : 0;
	config.steam.userId = steamUserId;

	pollForGameActivity();

	res.redirect('/config#steam');
});

interface PsnBody {
	psnEnabled?: string;
	psnDeviceId?: string;
	psnNpsso?: string;
}

router.post('/psn', async (req: RequestFrontend<object, PsnBody>, res) => {
	const psnIntervalMins = req.body.psnEnabled !== undefined ? 5 : 0;
	const psnNpsso = req.body.psnNpsso;
	const psnDeviceId = req.body.psnDeviceId;

	setConfigValue('psn_poll_interval_mins', `${psnIntervalMins}`);
	config.psn.pollIntervalMinutes = psnIntervalMins;

	if (psnDeviceId !== undefined) {
		setConfigValue('psn_device_id', psnDeviceId);
		config.psn.deviceId = psnDeviceId || null;
	}

	if (psnNpsso !== undefined && psnNpsso !== '') {
		setConfigValue('psn_npsso', psnNpsso);
		config.psn.npsso = psnNpsso;

		// Attempt to authenticate with PSN
		try {
			clearAuthentication();
			await authenticateApi();
		} catch (_err) {
			return res.redirect('/config#psn');
		}
	}

	pollForPsnActivity();

	res.redirect('/config#psn');
});

interface RetroAchievementsBody {
	retroachievementsEnabled?: string;
	retroachievementsApiKey: string;
	retroachievementsUsername: string;
	retroachievementDeviceId: string;
}

router.post('/retroachievements', (req: RequestFrontend<object, RetroAchievementsBody>, res) => {
	const enabled = req.body.retroachievementsEnabled !== undefined;
	const apiKey = req.body.retroachievementsApiKey || null;
	const username = req.body.retroachievementsUsername || null;
	const deviceId = req.body.retroachievementDeviceId || null;

	setConfigValue('retroachievements_poll_interval_mins', enabled ? '20' : '0');
	setConfigValue('retroachievements_apikey', apiKey);
	setConfigValue('retroachievements_device_id', deviceId);
	setConfigValue('retroachievements_username', username);

	config.retroachievements.pollIntervalMinutes = enabled ? 20 : 0;
	config.retroachievements.apiKey = apiKey;
	config.retroachievements.deviceId = deviceId;
	config.retroachievements.username = username;

	pollForRetroAchievementsActivity();

	res.redirect('/config#retroachievements');
});

interface SteamGridDbBody {
	steamgriddbApiKey: string;
}

router.post('/steamgriddb', (req: RequestFrontend<object, SteamGridDbBody>, res) => {
	const apiKey = req.body.steamgriddbApiKey || null;

	setConfigValue('steamgriddb_apikey', apiKey);
	config.steamgriddb.apiKey = apiKey;

	res.redirect('/config#steamgriddb');
});

interface LetterboxdBody {
	letterboxdEnabled?: string;
	letterboxdUsername: string;
}

router.post('/letterboxd', (req: RequestFrontend<object, LetterboxdBody>, res) => {
	const pollCron = req.body.letterboxdEnabled !== undefined ? convertPollIntervalToCron(1440) : null;
	const username = req.body.letterboxdUsername || null;

	setConfigValue('letterboxd_poll_cron', pollCron);
	setConfigValue('letterboxd_username', username);

	config.letterboxd.pollCron = pollCron;
	config.letterboxd.username = username;

	pollForFilmActivity();

	res.redirect('/config#letterboxd');
});

interface TmdbBody {
	tmdbAccessToken: string;
}

router.post('/tmdb', (req: RequestFrontend<object, TmdbBody>, res) => {
	const accessToken = req.body.tmdbAccessToken || null;

	setConfigValue('tmdb_access_token', accessToken);

	config.tmdb.accessToken = accessToken;

	res.redirect('/config#tmdb');
});

interface BlueskyBody {
	blueskyEnabled?: string;
	blueskyUsername: string;
	blueskyIncludeReplies: string;
	blueskyIncludeReposts: string;
}

router.post('/bluesky', (req: RequestFrontend<object, BlueskyBody>, res) => {
	const pollCron = req.body.blueskyEnabled !== undefined ? convertPollIntervalToCron(60) : null;
	const username = req.body.blueskyUsername || null;
	const includeReplies = req.body.blueskyIncludeReplies !== undefined;
	const includeReposts = req.body.blueskyIncludeReposts !== undefined;

	setConfigValue('bluesky_poll_cron', pollCron);
	setConfigValue('bluesky_username', username);
	setConfigValue('bluesky_include_replies', includeReplies ? 'true' : 'false');
	setConfigValue('bluesky_include_reposts', includeReposts ? 'true' : 'false');

	config.bluesky.pollCron = pollCron;
	config.bluesky.username = username;
	config.bluesky.includeReplies = includeReplies;
	config.bluesky.includeReposts = includeReposts;

	pollForBlueskyPosts();

	res.redirect('/config#bluesky');
});

interface DiscordBody {
	discordToken: string;
	discordChannelId: string;
}

router.post('/discord', (req: RequestFrontend<object, DiscordBody>, res) => {
	const token = req.body.discordToken || null;
	const channelId = req.body.discordChannelId || null;

	setConfigValue('discord_token', token);
	setConfigValue('discord_channelid', channelId);

	config.discord.token = token;
	config.discord.channelId = channelId;

	getDiscordClient();

	res.redirect('/config#discord');
});

interface GoogleBody {
	googleApiKey: string;
	googlePlacesApiEnabled?: string;
	googlePlacesIgnoredCategories: string;
}

router.post('/google', (req: RequestFrontend<object, GoogleBody>, res) => {
	const apiKey = req.body.googleApiKey || null;
	const placesApiEnabled = req.body.googlePlacesApiEnabled !== undefined;
	const placesApiIgnoredCategories = req.body.googlePlacesIgnoredCategories;
	const placesIgnoredCategoriesArray = placesApiIgnoredCategories.split(',');

	setConfigValue('google_apikey', apiKey);
	setConfigValue('google_placesapi_enabled', placesApiEnabled ? 'true' : 'false');
	setConfigValue('google_placesapi_categories_ignored', placesApiIgnoredCategories);

	config.google.apiKey = apiKey;
	config.google.placesApiEnabled = placesApiEnabled;
	config.google.placesApiIgnoredCategories = placesIgnoredCategoriesArray;

	res.redirect('/config#google');
});

interface SonarrBody {
	sonarrServerUrl: string;
	sonarrApiKey: string;
}

router.post('/sonarr', (req: RequestFrontend<object, SonarrBody>, res) => {
	const apiKey = req.body.sonarrApiKey || null;
	const serverUrl = req.body.sonarrServerUrl || null;

	setConfigValue('sonarr_apikey', apiKey);
	setConfigValue('sonarr_url', serverUrl);

	config.sonarr.apiKey = apiKey;
	config.sonarr.serverUrl = serverUrl;

	res.redirect('/config#sonarr');
});

interface SubsonicBody {
	subsonicUrl: string;
	subsonicUsername: string;
	subsonicPassword: string;
}

router.post('/subsonic', (req: RequestFrontend<object, SubsonicBody>, res) => {
	const url = req.body.subsonicUrl || null;
	const username = req.body.subsonicUsername || null;
	const password = req.body.subsonicPassword || null;

	setConfigValue('subsonic_url', url);
	setConfigValue('subsonic_username', username);
	setConfigValue('subsonic_password', password);

	config.subsonic.url = url;
	config.subsonic.username = username;
	config.subsonic.password = password;

	res.redirect('/config#subsonic');
});

interface SwarmBody {
	swarmClientId: string;
	swarmClientSecret: string;
	swarmPushSecret: string;
	swarmUserId: string;
}

router.post('/swarm', (req: RequestFrontend<object, SwarmBody>, res) => {
	const clientId = req.body.swarmClientId || null;
	const clientSecret = req.body.swarmClientSecret || null;
	const pushSecret = req.body.swarmPushSecret || null;
	const userId = req.body.swarmUserId || null;

	setConfigValue('swarm_client_id', clientId);
	setConfigValue('swarm_client_secret', clientSecret);
	setConfigValue('swarm_push_secret', pushSecret);
	setConfigValue('swarm_user_id', userId);

	config.swarm.oauthClientId = clientId;
	config.swarm.oauthClientSecret = clientSecret;
	config.swarm.pushSecret = pushSecret;
	config.swarm.userId = userId;

	res.redirect('/config#swarm');
});

interface KawaBody {
	kawaApiBaseUrl: string;
	kawaApiKey: string;
}

router.post('/kawa', (req: RequestFrontend<object, KawaBody>, res) => {
	const apiKey = req.body.kawaApiKey || null;
	const serverUrl = req.body.kawaApiBaseUrl || null;

	setConfigValue('kawa_auth_token', apiKey);
	setConfigValue('kawa_server_url', serverUrl);

	config.kawa.apiKey = apiKey;
	config.kawa.apiBaseUrl = serverUrl;

	res.redirect('/config#kawa');
});

export default router;
