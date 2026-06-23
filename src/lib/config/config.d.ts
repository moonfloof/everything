type Geocoder = {
	enabled: boolean;
	cachePath: string;
};

type Discord = {
	token: string | null;
	channelId: string | null;
};

type Google = {
	apiKey: string | null;
	placesApiEnabled: boolean;
	placesApiIgnoredCategories: string[];
};

type Letterboxd = {
	dataPath: string;
	username: string | null;
	pollCron: string | null;
};

type Tmdb = {
	apiBaseUrl: string;
	accessToken: string | null;
};

type Steam = {
	dataPath: string;
	apiKey: string | null;
	userId: string | null;
	deviceId: string | null;
	pollIntervalMinutes: number;
};

type Psn = {
	dataPath: string;
	npsso: string | null;
	deviceId: string | null;
	pollIntervalMinutes: number;
};

type RetroAchievements = {
	apiKey: string | null;
	username: string | null;
	pollIntervalMinutes: number;
	deviceId: string | null;
};

type SteamGridDb = {
	apiBaseUrl: string;
	apiKey: string | null;
};

type BlueSky = {
	dataPath: string;
	username: string | null;
	includeReplies: boolean;
	includeReposts: boolean;
	pollCron: string | null;
};

type Sonarr = {
	serverUrl: string | null;
	apiKey: string | null;
};

type Subsonic = {
	url: string | null;
	username: string | null;
	password: string | null;
};

type Location = {
	osmBaseUrl: string;
	dashboardDisplay: boolean;
	delayMins: number;
	privateLat: number;
	privateLong: number;
	privateRadius: number;
};

type Swarm = {
	dataPath: string;
	oauthClientId: string | null;
	oauthClientSecret: string | null;
	pushSecret: string | null;
	userId: string | null;
};

type Kawa = {
	apiBaseUrl: string | null;
	apiKey: string | null;
};

export type Config = {
	portExternal: string;
	portInternal: string;
	serverExternalUri: string;
	serverInternalUri: string;
	versionString: string | null;
	defaultDeviceId: string;
	personName: string;
	cacheDurationSecs: number;
	cacheClearCron: string | null;

	geocoder: Geocoder;
	discord: Discord;
	google: Google;
	letterboxd: Letterboxd;
	tmdb: Tmdb;
	steam: Steam;
	psn: Psn;
	retroachievements: RetroAchievements;
	steamgriddb: SteamGridDb;
	bluesky: BlueSky;
	sonarr: Sonarr;
	subsonic: Subsonic;
	location: Location;
	swarm: Swarm;
	kawa: Kawa;
};

export type ConfigKey =
	| 'version_string'
	| 'default_device_id'
	| 'person_name'
	| 'server_cache_duration_secs'
	| 'server_cache_clear_cron'
	| 'geocoder_enabled'
	| 'discord_token'
	| 'discord_channelid'
	| 'google_apikey'
	| 'google_placesapi_enabled'
	| 'google_placesapi_categories_ignored'
	| 'letterboxd_username'
	| 'letterboxd_poll_cron'
	| 'tmdb_access_token'
	| 'steam_apikey'
	| 'steam_userid'
	| 'steam_device_id'
	| 'steam_poll_interval_mins'
	| 'psn_npsso'
	| 'psn_device_id'
	| 'psn_poll_interval_mins'
	| 'retroachievements_apikey'
	| 'retroachievements_username'
	| 'retroachievements_poll_interval_mins'
	| 'retroachievements_device_id'
	| 'steamgriddb_apikey'
	| 'bluesky_username'
	| 'bluesky_include_replies'
	| 'bluesky_include_reposts'
	| 'bluesky_poll_cron'
	| 'sonarr_apikey'
	| 'sonarr_url'
	| 'subsonic_url'
	| 'subsonic_username'
	| 'subsonic_password'
	| 'location_display'
	| 'location_delay_mins'
	| 'location_private_override_lat'
	| 'location_private_override_long'
	| 'location_private_override_radius'
	| 'swarm_client_id'
	| 'swarm_client_secret'
	| 'swarm_push_secret'
	| 'swarm_user_id'
	| 'kawa_server_url'
	| 'kawa_auth_token';
