import fs from 'node:fs';
import path from 'node:path';
import phin from 'phin';
import { insertNewGameAchievement } from '../database/gameachievements.js';
import { updateActivity } from '../database/games.js';
import { minuteMs } from '../lib/formatDate.js';
import Logger from '../lib/logger.js';

const log = new Logger('Steam');

const ignoredGames = [
	250820, // Steam VR
	755540, // LIV
	1173510, // XSOverlay
	1009850, // OVR Advanced Settings
];

/**
 * @typedef {object} RemoteAchievement
 * @prop {string} apiname
 * @prop {number} achieved
 * @prop {number} unlocktime
 * @prop {string} name
 * @prop {string} description
 */

/**
 * @typedef {object} LocalAchievement
 * @prop {string} apiname
 * @prop {number} achieved
 */

/**
 * @typedef {object} GameActivity
 * @prop {number} appid
 * @prop {number} playtime_forever
 */

/** @type {GameActivity[]} */
let gameActivity = [];

/** @type {LocalAchievement[]} */
let achievements = {};

const storagePath = () => path.resolve(process.env.TOMBOIS_STEAM_DATA_FILE);

const loadGamesFromDisk = () => {
	log.info('Loading activity cache from disk');
	if (fs.existsSync(storagePath()) === false) {
		log.debug('Cache file does not exist, providing defaults');
		gameActivity = [];
		achievements = {};
		return;
	}

	const contents = JSON.parse(fs.readFileSync(storagePath()).toString());

	gameActivity = contents.gameActivity || [];
	achievements = contents.achievements || {};
};

const saveGamesToDisk = () => {
	log.info('Saving activity cache to disk');
	const str = JSON.stringify({ gameActivity, achievements }, null, 2);
	fs.writeFileSync(storagePath(), str);
};

/**
 * @param {number} appid
 * @return {Promise<RemoteAchievement[] | null>}
 */
const fetchAchievements = async appid => {
	const { TOMBOIS_STEAM_APIKEY: apiKey, TOMBOIS_STEAM_USERID: userId } = process.env;

	if (!apiKey || !userId) return null;

	const apiUrl = `http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${appid}&key=${apiKey}&steamid=${userId}&format=json&l=en`;

	try {
		const { body } = await phin({
			url: apiUrl,
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
		log.error(err.message, err);
		log.warn(
			'Marking this game as achievement-less. You will not recieve achievement updates for this game',
		);
		achievements[`${appid}`] = null;
		return null;
	}
};

const compareAchievements = async appid => {
	/** @type {LocalAchievement[]} */
	const localAchievements = achievements[`${appid}`];
	if (localAchievements === null) return [];

	/** @type {RemoteAchievement[]} */
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
};

export const pollForGameActivity = () => {
	const {
		TOMBOIS_STEAM_POLL_INTERVAL: pollIntervalMinutes,
		TOMBOIS_STEAM_APIKEY: apiKey,
		TOMBOIS_STEAM_USERID: userId,
		TOMBOIS_STEAM_DEVICE_ID: steamDeviceId,
		TOMBOIS_DEFAULT_DEVICE_ID: deviceId,
	} = process.env;

	const intervalMs = (Number(pollIntervalMinutes) ?? 5) * minuteMs;
	if (intervalMs === 0) return;

	loadGamesFromDisk();

	const apiUrl = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${apiKey}&steamid=${userId}&format=json`;

	const fetchGames = async () => {
		log.info('Polling steam for new game activity');

		const { body } = await phin({
			url: apiUrl,
			parse: 'json',
		});

		const newActivity = [];

		for (const game of body.response.games) {
			if (ignoredGames.includes(game.appid)) continue;

			const activity = {
				...game,
				newPlaytime: game.playtime_2weeks,
			};

			const existing = gameActivity.find(cache => game.appid === cache.appid);
			if (!existing) {
				newActivity.push(activity);
				return;
			}

			activity.newPlaytime = game.playtime_forever - existing.playtime_forever;
			if (activity.newPlaytime <= 0) {
				return;
			}

			newActivity.push(activity);
		}

		log.debug(`Found ${newActivity.length} instances of new activity`);

		// Update all new same-game activity
		for (let i = newActivity.length - 1; i >= 0; i--) {
			const game = newActivity[i];

			const activity = updateActivity(
				game.name,
				game.newPlaytime,
				`https://store.steampowered.com/app/${game.appid}/`,
				steamDeviceId || deviceId,
				intervalMs,
			);

			const newAchievements = await compareAchievements(game.appid);

			for (const achievement of newAchievements) {
				insertNewGameAchievement(
					achievement.name,
					achievement.description,
					game.name,
					activity.id,
					steamDeviceId || deviceId,
				);
			}
		}

		gameActivity = body.response.games.map(game => ({
			appid: game.appid,
			playtime_forever: game.playtime_forever,
		}));

		saveGamesToDisk();
	};

	setInterval(fetchGames, intervalMs);
};
