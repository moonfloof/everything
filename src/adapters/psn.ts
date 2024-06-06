import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { AuthTokensResponse, TitleTrophiesResponse, UserTrophiesEarnedForTitleResponse } from 'psn-api';
const {
	exchangeCodeForAccessToken,
	exchangeNpssoForCode,
	exchangeRefreshTokenForAuthTokens,
	getBasicPresence,
	getTitleTrophies,
	getUserTitles,
	getUserTrophiesEarnedForTitle,
} = createRequire(import.meta.url)('psn-api');

import { insertNewGameAchievement } from '../database/gameachievements.js';
import { updateActivity } from '../database/games.js';
import { config } from '../lib/config.js';
import { minuteMs } from '../lib/formatDate.js';
import Logger from '../lib/logger.js';

const log = new Logger('PSN');

/** Used to map `npTitleId` to `npCommunicationId` */
let gameIdMap: Record<string, string> = {};

interface UserTrophies {
	trophyId: number;
	earned: boolean;
	earnedDateTime?: string;
}

interface ServerTrophies {
	trophyId: number;
	trophyName?: string;
	trophyDetail?: string;
}

let trophies: Record<string, { user: UserTrophies[]; server: ServerTrophies[] }> = {};

/** This data is private and, as such, the PSN JSON file should NEVER be shared. */
interface PSNAuthentication {
	accessTokenExpiryDate: Date;
	refreshTokenExpiryDate: Date;
}

let authentication: AuthTokensResponse & PSNAuthentication;

function loadGamesFromDisk() {
	log.info('Loading activity cache from disk');
	if (existsSync(config.psn.dataPath) === false) {
		log.debug('Cache file does not exist, providing defaults');
		gameIdMap = {};
		trophies = {};
		return;
	}

	const contents = JSON.parse(readFileSync(config.psn.dataPath).toString());

	gameIdMap = contents.gameIdMap || {};
	trophies = contents.trophies || {};
	authentication = contents.authentication || {};
	authentication.accessTokenExpiryDate = new Date(authentication.accessTokenExpiryDate);
	authentication.refreshTokenExpiryDate = new Date(authentication.refreshTokenExpiryDate);
}

function saveGamesToDisk() {
	log.info('Saving activity cache to disk');
	const str = JSON.stringify({ gameIdMap, trophies, authentication }, null, 2);
	writeFileSync(config.psn.dataPath, str);
}

function convertPsnAuth(auth: AuthTokensResponse) {
	return {
		...auth,
		accessTokenExpiryDate: new Date(Date.now() + auth.expiresIn * 1000),
		refreshTokenExpiryDate: new Date(Date.now() + auth.refreshTokenExpiresIn * 1000),
	};
}

async function authenticateApi() {
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

	// No access token means we need to get one using the NPSSO service
	if (!config.psn.npsso) {
		throw new Error('Cannot authenticate with PSN. Please provide a new NPSSO and restart the server');
	}

	log.info('Fetching an access code based on NPSSO');
	const accessCode = await exchangeNpssoForCode(config.psn.npsso);
	const newAuthentication = await exchangeCodeForAccessToken(accessCode);
	authentication = convertPsnAuth(newAuthentication);
	saveGamesToDisk();
}

async function compareTrophies(game: { titleName: string; format: 'PS5' | 'ps4' }) {
	const gameName = game.titleName.replace(/[^a-zA-Z0-9]*/g, '');

	// The communication ID is associated with a specific user's games,
	// so we need to cache the IDs before we can fetch their trophies.
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
	if (game.format !== 'PS5') options = { npServiceName: 'trophy' as const };

	log.debug(`Fetching user trophies for ${game.titleName}`);
	const { trophies: remoteTrophies }: UserTrophiesEarnedForTitleResponse = await getUserTrophiesEarnedForTitle(
		authentication,
		'me',
		id,
		'all',
		options,
	);

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

	if (!trophies[id]) {
		trophies[id] = { user: [], server: [] };
	}

	trophies[id].user = remoteTrophies.map(trophy => ({
		trophyId: trophy.trophyId,
		earned: trophy.earned ?? false,
		earnedDateTime: trophy.earnedDateTime,
	}));

	if (newTrophies.length > 0 && !trophies[id].server) {
		log.debug(`Fetching server trophies for ${game.titleName}`);

		const serverTrophies: TitleTrophiesResponse = await getTitleTrophies(
			authentication,
			id,
			'all',
			options,
		);

		trophies[id].server = serverTrophies.trophies.map(trophy => ({
			trophyId: trophy.trophyId,
			trophyName: trophy.trophyName,
			trophyDetail: trophy.trophyDetail,
		}));
	}

	// Add title and description to new trophies
	return newTrophies.map(trophy => {
		const serverTrophy = trophies[id].server.find(server => server.trophyId === trophy.trophyId);
		return {
			...trophy,
			trophyName: serverTrophy?.trophyName || '',
			trophyDetail: serverTrophy?.trophyDetail || null,
		};
	});
}

async function fetchGameActivity() {
	await authenticateApi();

	const {
		basicPresence: { gameTitleInfoList },
	} = await getBasicPresence(authentication, 'me');

	if (!gameTitleInfoList) return;

	const device_id = config.psn.deviceId ?? config.defaultDeviceId;

	for (const game of gameTitleInfoList) {
		const newTrophies = await compareTrophies(game);

		if (newTrophies.length > 0) {
			log.info(`${newTrophies.length} new trophies for ${game.titleName}`);
		}

		const activity = updateActivity(
			{
				name: game.titleName,
				playtime_mins: config.psn.pollInterval,
				url: null,
				device_id,
			},
			config.psn.pollInterval * minuteMs,
		);

		for (const trophy of newTrophies) {
			insertNewGameAchievement({
				name: trophy.trophyName,
				description: trophy.trophyDetail,
				game_name: game.titleName,
				game_id: activity.id,
				device_id,
				created_at: '',
			});
		}
	}

	saveGamesToDisk();
}

export function pollForPsnActivity() {
	const pollIntervalMs = config.psn.pollInterval * minuteMs;
	if (pollIntervalMs === 0) {
		log.warn('Polling disabled, no games will be tracked');
		return;
	}

	loadGamesFromDisk();

	fetchGameActivity();
	setInterval(fetchGameActivity, pollIntervalMs);
}
