import fs from 'node:fs';
import path from 'node:path';

import { insertNewGameAchievement } from '../database/gameachievements.js';
import { updateActivity } from '../database/games.js';
import { minuteMs } from '../lib/formatDate.js';
import Logger from '../lib/logger.js';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const psnApi = require('psn-api');
const {
	exchangeCodeForAccessToken,
	exchangeNpssoForCode,
	exchangeRefreshTokenForAuthTokens,
	getBasicPresence,
	getUserTrophiesEarnedForTitle,
	getUserTitles,
} = psnApi;

const log = new Logger('PSN');

/**
 * Used to map `npTitleId` to `npCommunicationId`
 * @type {Record<string, string>}
 */
let gameIdMap = {};

/**
 * @typedef {object} UserTrophies
 * @prop {number} trophyId
 * @prop {boolean} earned
 * @prop {string} earnedDateTime
 */

/**
 * @typedef {object} ServerTrophies
 * @prop {number} trophyId
 * @prop {string} trophyName
 * @prop {string} trophyDetail
 */

/** @type {Record<string, { "user": UserTrophies[], "server": ServerTrophies[] }>} */
let trophies = {};

/**
 * @typedef {object} PSNAuthentication
 * This data is private and, as such, the PSN JSON file should NEVER be shared.
 *
 * @prop {string} accessToken
 * @prop {Date} accessTokenExpiryDate
 * @prop {string} refreshToken
 * @prop {Date} refreshTokenExpiryDate
 * @prop {string} idToken
 * @prop {string} scope
 * @prop {string} tokenType
 */

/** @type {PSNAuthentication} */
let authentication = {};

const storagePath = () => path.resolve(process.env.TOMBOIS_PSN_DATA_FILE);

const loadGamesFromDisk = () => {
	log.info('Loading activity cache from disk');
	if (fs.existsSync(storagePath()) === false) {
		log.debug('Cache file does not exist, providing defaults');
		gameIdMap = {};
		trophies = {};
		return;
	}

	const contents = JSON.parse(fs.readFileSync(storagePath()).toString());

	gameIdMap = contents.gameIdMap || {};
	trophies = contents.trophies || {};
	authentication = contents.authentication || {};
	authentication.accessTokenExpiryDate = new Date(authentication.accessTokenExpiryDate);
	authentication.refreshTokenExpiryDate = new Date(authentication.refreshTokenExpiryDate);
};

const saveGamesToDisk = () => {
	log.info('Saving activity cache to disk');
	const str = JSON.stringify({ gameIdMap, trophies, authentication }, null, 2);
	fs.writeFileSync(storagePath(), str);
};

/** @param {import('psn-api').AuthTokensResponse} auth */
const convertPsnAuth = auth => {
	return {
		...auth,
		accessTokenExpiryDate: new Date(Date.now() + auth.expiresIn * 1000),
		refreshTokenExpiryDate: new Date(Date.now() + auth.refreshTokenExpiresIn * 1000),
	};
};

const authenticateApi = async () => {
	if (authentication.accessToken) {
		// Access token hasn't expired
		if ((authentication.accessTokenExpiryDate?.getTime() || 0) - Date.now() > 0) {
			return;
		}

		// Refresh token HAS expired
		if ((authentication.refreshTokenExpiryDate?.getTime() || 0) - Date.now() < 0) {
			throw new Error(
				'Cannot generate new PSN credentials. Please provide a new NPSSO and restart the server',
			);
		}

		log.info('Access token has expired - fetching a new one.');
		const newAuthentication = await exchangeRefreshTokenForAuthTokens(authentication.refreshToken);
		authentication = convertPsnAuth(newAuthentication);
		saveGamesToDisk();
		return;
	}

	// No access token means we need to get one using the NPSSO
	const npsso = process.env.TOMBOIS_PSN_NPSSO;

	if (!npsso) {
		throw new Error('Cannot authenticate with PSN. Please provide a new NPSSO and restart the server');
	}

	log.info('Fetching an access code based on NPSSO');
	const accessCode = await exchangeNpssoForCode(npsso);
	const newAuthentication = await exchangeCodeForAccessToken(accessCode);
	authentication = convertPsnAuth(newAuthentication);
	saveGamesToDisk();
};

/**
 *
 *
 * @param {*} game
 */
const compareTrophies = async game => {
	const gameName = game.titleName.replace(/[^a-zA-Z0-9]*/g, '');
	let id = gameIdMap[gameName];
	if (!gameIdMap[gameName]) {
		log.debug('Fetching recently played games');
		const response = await getUserTitles(authentication, 'me');
		for (const title of response.trophyTitles) {
			const titleName = title.trophyTitleName.replace(/[^a-zA-Z0-9]*/g, '');
			if (!gameIdMap[titleName]) {
				gameIdMap[titleName] = title.npCommunicationId;
			}
		}

		id = gameIdMap[gameName];
		if (!id) {
			log.error('Could not find Communication ID from user titles. Cannot save achievements');
			return [];
		}
	}

	let options = undefined;
	if (game.format !== 'PS5') options = { npServiceName: 'trophy' };

	log.debug(`Fetching user trophies for ${game.titleName}`);
	const response = await getUserTrophiesEarnedForTitle(authentication, 'me', id, 'all', options);
	const remoteTrophies = response.trophies;

	const newTrophies = remoteTrophies.filter(remoteTrophy => {
		// Skip achievements the first time they are loaded
		if (trophies[id] === undefined) return false;

		return trophies[id].user.some(
			localAchievement =>
				localAchievement.trophyId === remoteTrophy.trophyId &&
				!localAchievement.earned &&
				remoteTrophy.earned === true,
		);
	});

	if (!trophies[id]) trophies[id] = {};

	trophies[id].user = remoteTrophies.map(trophy => ({
		trophyId: trophy.trophyId,
		earned: trophy.earned,
		earnedDateTime: trophy.earnedDateTime,
	}));

	if (newTrophies.length > 0 && !trophies[id].server) {
		log.debug(`Fetching server trophies for ${game.titleName}`);
		const serverTrophies = await psnApi.getTitleTrophies(authentication, id, 'all', options);
		trophies[id].server = serverTrophies.trophies.map(trophy => ({
			trophyId: trophy.trophyId,
			trophyName: trophy.trophyName,
			trophyDetail: trophy.trophyDetail,
		}));
	}

	// Add title and description to new trophies
	return newTrophies.map(trophy => {
		const server = trophies[id].server.find(serverTrophy => serverTrophy.trophyId === trophy.trophyId);
		return {
			...trophy,
			trophyName: server.trophyName,
			trophyDetail: server.trophyDetail,
		};
	});
};

const fetchGameActivity = async () => {
	await authenticateApi();

	const {
		basicPresence: { gameTitleInfoList },
	} = await getBasicPresence(authentication, 'me');

	if (!gameTitleInfoList) return;

	const {
		TOMBOIS_PSN_POLL_INTERVAL: pollInterval,
		TOMBOIS_PSN_DEVICE_ID: psnDeviceId,
		TOMBOIS_DEFAULT_DEVICE_ID: defaultDeviceId,
	} = process.env;

	const playTimeMinutes = Number(pollInterval) ?? 5;
	const deviceId = psnDeviceId || defaultDeviceId;

	for (let i = 0; i < gameTitleInfoList.length; i++) {
		const game = gameTitleInfoList[i];
		const newTrophies = await compareTrophies(game);

		if (newTrophies.length > 0) {
			log.info(`${newTrophies.length} new trophies for ${game.titleName}`);
		}

		const activity = updateActivity(
			game.titleName,
			playTimeMinutes,
			null,
			deviceId,
			playTimeMinutes * minuteMs,
		);

		for (const trophy of newTrophies) {
			insertNewGameAchievement(
				trophy.trophyName,
				trophy.trophyDetail,
				game.titleName,
				activity.id,
				deviceId,
			);
		}
	}

	saveGamesToDisk();
};

export const pollForPsnActivity = () => {
	const pollIntervalMinutes = process.env.TOMBOIS_PSN_POLL_INTERVAL;
	const pollIntervalMs = (Number(pollIntervalMinutes) ?? 5) * minuteMs;
	if (pollIntervalMs === 0) return;

	loadGamesFromDisk();

	fetchGameActivity();
	setInterval(fetchGameActivity, pollIntervalMs);
};
