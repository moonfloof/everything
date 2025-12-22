import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import phin from 'phin';
import { getAchievementsForGame } from '../database/game.js';
import { type GameAchievement, insertNewGameAchievement, updateGameAchievement } from '../database/gameachievements.js';
import { updateGameSession } from '../database/gamesession.js';
import { config } from '../lib/config.js';
import { dateDefault, minuteMs } from '../lib/formatDate.js';
import Logger from '../lib/logger.js';
import { getImagePath, saveImageToDisk } from '../lib/mediaFiles.js';

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

let gameActivity: Pick<SteamRecentlyPlayedGame, 'appid' | 'playtime_forever'>[] = [];

function loadGamesFromDisk() {
	log.info('Loading activity cache from disk');
	if (existsSync(config.steam.dataPath) === false) {
		log.debug('Cache file does not exist, providing defaults');
		gameActivity = [];
		return;
	}

	const contents = JSON.parse(readFileSync(config.steam.dataPath).toString());

	gameActivity = contents.gameActivity || [];
}

function saveGamesToDisk() {
	log.info('Saving activity cache to disk');
	const str = JSON.stringify({ gameActivity }, null, 2);
	writeFileSync(config.steam.dataPath, str);
}

export function saveImages(appid: number, game_id: number) {
	const heroPath = getImagePath('game', `hero-${game_id}`);
	const heroUrl = `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/library_hero.jpg`;
	saveImageToDisk(heroUrl, heroPath);

	const libraryPath = getImagePath('game', `library-${game_id}`);
	const libraryUrl = `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/library_600x900.jpg`;
	saveImageToDisk(libraryUrl, libraryPath);
}

async function fetchAchievements(appid: number): Promise<SteamAchievement[]> {
	const { apiKey, userId } = config.steam;

	if (!(apiKey && userId)) return [];

	const apiUrl = `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${appid}&key=${apiKey}&steamid=${userId}&format=json&l=en`;

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

		return body.playerstats.achievements;
	} catch (err) {
		const error = err as Error;
		log.error(error);
		return [];
	}
}

export async function updateSteamAchievementsDatabase(appid: number, session: { id: string; game_id: number }) {
	const remoteAchievements = await fetchAchievements(appid);
	const achievementsForGame = getAchievementsForGame(session.game_id);
	let inserted = 0;
	let updated = 0;

	for (const achievement of remoteAchievements) {
		// Unlock Time is 0 if not achieved (therefore defaults to current time)
		const updated_at = dateDefault(achievement.unlocktime * 1000);
		const achieved = achievement.achieved === 1;

		// Match local achievements based on apiname (preferred) or name (fallback)
		const existsInDatabase = achievementsForGame.find(
			local => local.apiname === achievement.apiname || local.name === achievement.name,
		);

		if (!existsInDatabase) {
			insertNewGameAchievement({
				name: achievement.name,
				description: achievement.description || null,
				game_id: session.game_id,
				unlocked_session_id: achieved ? session.id : null,
				apiname: achievement.apiname,
				created_at: '',
				updated_at,
			});
			inserted++;
			continue;
		}

		const updates: Partial<GameAchievement> = {};

		if (existsInDatabase.unlocked_session_id === null && achievement.achieved === 1) {
			updates.unlocked_session_id = session.id;
			updates.updated_at = updated_at;
		}

		if (existsInDatabase.apiname === null) {
			updates.apiname = achievement.apiname;
		}

		if (Object.keys(updates).length > 0) {
			updateGameAchievement({
				...existsInDatabase,
				...updates,
			});
			updated++;
		}
	}

	log.info(`${inserted} achievements inserted, ${updated} updated`);
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

	const intervalMs = config.steam.pollIntervalMinutes * minuteMs;
	if (intervalMs === 0 || !apiKey) {
		log.warn('Polling is disabled, no games will be tracked');
		return;
	}

	loadGamesFromDisk();

	const apiUrl = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${apiKey}&steamid=${userId}&format=json`;

	const fetchGames = async () => {
		log.info('Polling steam for new game activity');

		const { body } = await phin<SteamRecentlyPlayedGamesResponse>({
			url: apiUrl,
			headers: {
				'User-Agent': config.versionString,
			},
			parse: 'json',
		});

		const newActivity = calculateNewActivity(body.response.games);

		// Update all new same-game activity
		for (const game of newActivity) {
			const session = updateGameSession(
				{
					name: game.name,
					playtime_mins: game.newPlaytime,
					url: `https://store.steampowered.com/app/${game.appid}/`,
					device_id: config.steam.steamDeviceId,
				},
				intervalMs,
			);

			await updateSteamAchievementsDatabase(game.appid, session);
			saveImages(game.appid, session.game_id);
		}

		gameActivity = body.response.games.map(game => ({
			appid: game.appid,
			playtime_forever: game.playtime_forever,
		}));

		saveGamesToDisk();
	};

	setInterval(fetchGames, intervalMs);
}
