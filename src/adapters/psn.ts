import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type {
	AuthTokensResponse,
	BasicPresenceResponse,
	TitleTrophiesResponse,
	UserTitlesResponse,
	UserTrophiesEarnedForTitleResponse,
} from 'psn-api';
const {
	exchangeCodeForAccessToken,
	exchangeNpssoForCode,
	exchangeRefreshTokenForAuthTokens,
	getBasicPresence,
	getTitleTrophies,
	getUserTitles,
	getUserTrophiesEarnedForTitle,
} = createRequire(import.meta.url)('psn-api');
import { getAchievementsForGame, getGameById } from '../database/game.js';
import { type GameAchievement, insertNewGameAchievement, updateGameAchievement } from '../database/gameachievements.js';
import { type GameSessionInsertResponse, updateGameSession } from '../database/gamesession.js';
import { config } from '../lib/config.js';
import { minuteMs } from '../lib/formatDate.js';
import Logger from '../lib/logger.js';
import { searchForImages } from './steamgriddb.js';

const log = new Logger('PSN');

/** Used to map `npTitleId` to `npCommunicationId` */
let gameIdMap: Record<string, string> = {};

interface ServerTrophies {
	trophyId: number;
	trophyName?: string;
	trophyDetail?: string;
}

let trophies: Record<string, { server: ServerTrophies[] }> = {};

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
		const newAuthentication: AuthTokensResponse = await exchangeRefreshTokenForAuthTokens(
			authentication.refreshToken,
		);
		authentication = convertPsnAuth(newAuthentication);
		saveGamesToDisk();
		return;
	}

	// No access token means we need to get one using the NPSSO service
	if (!config.psn.npsso) {
		throw new Error('Cannot authenticate with PSN. Please provide a new NPSSO and restart the server');
	}

	log.info('Fetching an access code based on NPSSO');
	const accessCode: string = await exchangeNpssoForCode(config.psn.npsso);
	const newAuthentication: AuthTokensResponse = await exchangeCodeForAccessToken(accessCode);
	authentication = convertPsnAuth(newAuthentication);
	saveGamesToDisk();
}

async function updateAchievementsDatabase(
	game: { titleName: string; format: 'PS5' | 'ps4' },
	session: GameSessionInsertResponse,
) {
	const localTrophies = getAchievementsForGame(session.game_id);
	const remoteTrophies = await getTrophiesForGame(game);
	let inserted = 0;
	let updated = 0;

	for (const trophy of remoteTrophies) {
		// Match local achievements based on apiname (preferred) or name (fallback)
		const existsInDatabase = localTrophies.find(
			local => local.apiname === trophy.trophyId || local.name === trophy.trophyName,
		);

		if (!existsInDatabase) {
			insertNewGameAchievement({
				name: trophy.trophyName,
				description: trophy.trophyDetail || null,
				game_id: session.game_id,
				unlocked_session_id: trophy.earned ? session.id : null,
				apiname: trophy.trophyId,
				created_at: '',
				updated_at: trophy.earnedDateTime ?? '',
			});
			inserted++;
			continue;
		}

		const updates: Partial<GameAchievement> = {};

		if (existsInDatabase.unlocked_session_id === null && trophy.earned === true) {
			updates.unlocked_session_id = session.id;
			updates.updated_at = trophy.earnedDateTime;
		}

		if (existsInDatabase.apiname === null) {
			updates.apiname = trophy.trophyId;
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

async function getTrophiesForGame(game: { titleName: string; format: 'PS5' | 'ps4' }) {
	const gameName = game.titleName.replace(/[^a-zA-Z0-9]*/g, '');

	// The communication ID is associated with a specific user's games,
	// so we need to cache the IDs before we can fetch their trophies.
	let id = gameIdMap[gameName];
	if (!gameIdMap[gameName]) {
		log.debug('Fetching recently played games');
		const response: UserTitlesResponse = await getUserTitles(authentication, 'me');
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

	// Cache full trophy info (name, description), if not already cached
	if (remoteTrophies.length > 0 && !trophies[id]?.server?.length) {
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
	return remoteTrophies.map(trophy => {
		const serverTrophy = trophies[id].server.find(server => server.trophyId === trophy.trophyId);

		// A pretty ugly fallback, something like "GranTurismo7 - 28"
		// but it'll satisfy the UNIQUE constraint on achievement name.
		const fallbackTrophyName = `${gameName} - ${trophy.trophyId}`;

		return {
			...trophy,
			trophyId: `${trophy.trophyId}`,
			trophyName: serverTrophy?.trophyName || fallbackTrophyName,
			trophyDetail: serverTrophy?.trophyDetail || null,
		};
	});
}

async function fetchGameActivity() {
	await authenticateApi();

	const {
		basicPresence: { gameTitleInfoList },
	}: BasicPresenceResponse = await getBasicPresence(authentication, 'me');

	if (!gameTitleInfoList) return;

	for (const game of gameTitleInfoList) {
		const session = updateGameSession(
			{
				name: game.titleName,
				playtime_mins: config.psn.pollIntervalMinutes,
				url: null,
				device_id: config.psn.deviceId,
			},
			config.psn.pollIntervalMinutes * minuteMs,
		);

		await updateAchievementsDatabase(game, session);

		try {
			const gameRecord = getGameById(session.game_id);
			if (!gameRecord) continue;

			await searchForImages(game.titleName, gameRecord);
		} catch (err) {
			/* do nothing */
		}
	}

	saveGamesToDisk();
}

export function pollForPsnActivity() {
	const pollIntervalMs = config.psn.pollIntervalMinutes * minuteMs;
	if (pollIntervalMs === 0) {
		log.warn('Polling disabled, no games will be tracked');
		return;
	}

	loadGamesFromDisk();
	setInterval(fetchGameActivity, pollIntervalMs);
}
