import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import phin from 'phin';
import { insertNewGameAchievement } from '../database/gameachievements.js';
import { updateActivity } from '../database/games.js';
import { config } from '../lib/config.js';
import { minuteMs } from '../lib/formatDate.js';
import Logger from '../lib/logger.js';

const log = new Logger('Steam');

const ignoredGames = [
	250820, // Steam VR
	755540, // LIV
	1173510, // XSOverlay
	1009850, // OVR Advanced Settings
];

interface SteamRecentlyPlayedGame {
	appid: number;
	name: string;
	playtime_2weeks: number;
	playtime_forever: number;
	img_icon_url: string;
	playtime_windows_forever: number;
	playtime_mac_forever: number;
	playtime_linux_forever: number;
	playtime_deck_forever: number;
}

interface SteamRecentlyPlayedGamesResponse {
	response: {
		total_count: number;
		games: SteamRecentlyPlayedGame[];
	};
}

interface SteamAchievement {
	apiname: string;
	achieved: 0 | 1;
	unlocktime: number;
	name: string;
	description: string;
}

interface SteamGetPlayerAchievementsResponse {
	playerstats: {
		steamID: string;
		gameName: string;
		achievements: SteamAchievement[];
		success: boolean;
	};
}

interface LocalAchievement {
	apiname: string;
	achieved: number;
}

let gameActivity: Pick<SteamRecentlyPlayedGame, 'appid' | 'playtime_forever'>[] = [];

let achievements: Record<string, LocalAchievement[] | null> = {};

function loadGamesFromDisk() {
	log.info('Loading activity cache from disk');
	if (existsSync(config.steam.dataPath) === false) {
		log.debug('Cache file does not exist, providing defaults');
		gameActivity = [];
		achievements = {};
		return;
	}

	const contents = JSON.parse(readFileSync(config.steam.dataPath).toString());

	gameActivity = contents.gameActivity || [];
	achievements = contents.achievements || {};
}

function saveGamesToDisk() {
	log.info('Saving activity cache to disk');
	const str = JSON.stringify({ gameActivity, achievements }, null, 2);
	writeFileSync(config.steam.dataPath, str);
}

async function fetchAchievements(appid: number): Promise<SteamAchievement[] | null> {
	const { apiKey, userId } = config.steam;

	if (!(apiKey && userId)) return null;

	const apiUrl = `http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${appid}&key=${apiKey}&steamid=${userId}&format=json&l=en`;

	try {
		const { body } = await phin<SteamGetPlayerAchievementsResponse>({
			url: apiUrl,
			headers: {
				'User-Agent': config.versionString,
			},
			parse: 'json',
		});

		if (!body?.playerstats?.achievements) {
			throw new Error('No achievements');
		}

		achievements[`${appid}`] = body.playerstats.achievements.map(achievement => ({
			apiname: achievement.apiname,
			achieved: achievement.achieved,
		}));

		return body.playerstats.achievements;
	} catch (err) {
		const error = err as Error;
		log.error(error);
		log.warn(
			'Marking this game as achievement-less. You will not recieve achievement updates for this game',
		);
		achievements[`${appid}`] = null;
		return null;
	}
}

async function compareAchievements(appid: number): Promise<SteamAchievement[]> {
	const localAchievements = achievements[`${appid}`];
	if (localAchievements === null) return [];

	const remoteAchievements = await fetchAchievements(appid);
	if (!remoteAchievements) return [];

	return remoteAchievements.filter(remoteAchievement => {
		// Skip achievements the first time they are loaded
		// TODO: Calculate based on the "unlocktime" property
		if (localAchievements === undefined) return false;

		return localAchievements.some(
			localAchievement =>
				localAchievement.apiname === remoteAchievement.apiname &&
				localAchievement.achieved === 0 &&
				remoteAchievement.achieved === 1,
		);
	});
}

function calculateNewActivity(games: SteamRecentlyPlayedGame[]) {
	const newActivity = [];

	for (const game of games) {
		if (ignoredGames.includes(game.appid)) continue;

		const activity = {
			...game,
			newPlaytime: game.playtime_2weeks,
		};

		const existing = gameActivity.find(cache => game.appid === cache.appid);
		if (!existing) {
			newActivity.unshift(activity);
			continue;
		}

		activity.newPlaytime = game.playtime_forever - existing.playtime_forever;
		if (activity.newPlaytime <= 0) {
			continue;
		}

		newActivity.unshift(activity);
	}

	log.debug(`Found ${newActivity.length} instances of new activity`);

	return newActivity;
}

export function pollForGameActivity() {
	const { apiKey, userId } = config.steam;

	const intervalMs = (Number(config.steam.pollIntervalMinutes) ?? 5) * minuteMs;
	if (intervalMs === 0) {
		log.warn('Polling is disabled, no games will be tracked');
		return;
	}

	loadGamesFromDisk();

	const device_id = config.steam.steamDeviceId ?? config.defaultDeviceId;
	const apiUrl = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${apiKey}&steamid=${userId}&format=json`;

	const fetchGames = async () => {
		log.info('Polling steam for new game activity');

		const { body } = await phin<SteamRecentlyPlayedGamesResponse>({
			url: apiUrl,
			parse: 'json',
		});

		const newActivity = calculateNewActivity(body.response.games);

		// Update all new same-game activity
		for (const game of newActivity) {
			const activity = updateActivity(
				{
					name: game.name,
					playtime_mins: game.newPlaytime,
					url: `https://store.steampowered.com/app/${game.appid}/`,
					device_id,
				},
				intervalMs,
			);

			const newAchievements = await compareAchievements(game.appid);

			for (const achievement of newAchievements) {
				insertNewGameAchievement({
					name: achievement.name,
					description: achievement.description || null,
					game_name: game.name,
					game_id: activity.id,
					device_id,
					created_at: '',
				});
			}
		}

		gameActivity = body.response.games.map(game => ({
			appid: game.appid,
			playtime_forever: game.playtime_forever,
		}));

		saveGamesToDisk();
	};

	setInterval(fetchGames, intervalMs);
}
