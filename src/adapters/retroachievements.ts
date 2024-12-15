import phin from 'phin';
import {
	type GameAchievement,
	getGameAchievementsForGame,
	insertNewGameAchievement,
	updateGameAchievement,
} from '../database/gameachievements.js';
import { updateGameSession } from '../database/gamesession.js';
import { config } from '../lib/config.js';
import { minuteMs } from '../lib/formatDate.js';
import Logger from '../lib/logger.js';

const log = new Logger('RetroAchievements');

const request = <T>(url: string, params: URLSearchParams = new URLSearchParams()) => {
	const { apiKey, username } = config.retroachievements;

	if (!(apiKey && username)) {
		throw new Error('Both API_KEY and USERNAME must be provided');
	}

	params.append('u', username);
	params.append('y', apiKey);

	return phin<T>({
		url: `${url}?${params.toString()}`,
		method: 'GET',
		parse: 'json',
		headers: {
			'User-Agent': config.versionString,
		},
	});
};

interface RaSession {
	raGameId: number;
	game_id: number;
	session_id: string;
}

interface RecentlyPlayedGame {
	GameID: number;
	ConsoleID: number;
	ConsoleName: string;
	Title: string;
	ImageIcon: string;
	ImageTitle: string;
	ImageIngame: string;
	ImageBoxArt: string;
	LastPlayed: string;
	AchievementsTotal: number;
	NumPossibleAchievements: number;
	PossibleScore: number;
	NumAchieved: number;
	ScoreAchieved: number;
	NumAchievedHardcore: number;
	ScoreAchievedHardcore: number;
}

interface RecentAchievement {
	Date: string;
	HardcodeMode: 0 | 1;
	AchievementID: number;
	Title: string;
	Description: string;
	BadgeName: string;
	Points: number;
	TrueRatio: number;
	Type: string | null;
	Author: string;
	GameID: number;
	GameTitle: string;
	GameIcon: string;
	ConsoleName: string;
	GameURL: string;
}

interface RemoteAchievements {
	ID: number;
	Title: string;
	ConsoleID: number;
	ForumTopicID: number;
	ImageIcon: string;
	ImageTitle: string;
	ImageIngame: string;
	ImageBoxArt: string;
	Publisher: string;
	Developer: string;
	Genre: string;
	Released: string;
	ReleasedAtGranularity: string;
	IsFinal: 0 | 1;
	RichPresencePatch: string;
	GuideURL: null;
	ConsoleName: string;
	ParentGameID: null;
	NumDistinctPlayers: number;
	NumAchievements: number;
	Achievements: Record<
		string,
		{
			ID: number;
			NumAwarded: number;
			NumAwardedHardcore: number;
			Title: string;
			Description: string;
			Points: number;
			TrueRatio: number;
			Author: string;
			DateModified: string;
			DateCreated: string;
			BadgeName: string;
			DisplayOrder: number;
			MemAddr: string;
			type: string;

			// Only shows up if earned
			DateEarnedHardcore?: string;
			DateEarned?: string;
		}
	>;
	NumAwardedToUser: number;
	NumAwardedToUserHardcore: number;
	NumDistinctPlayersCasual: number;
	NumDistinctPlayersHardcore: number;
	UserCompletion: string;
	UserCompletionHardcore: string;
}

async function fetchRecentlyPlayedGames(): Promise<RecentlyPlayedGame[]> {
	const { body } = await request<RecentlyPlayedGame[]>(
		'https://retroachievements.org/API/API_GetUserRecentlyPlayedGames.php',
	);
	return body;
}

async function fetchRecentAchievements(): Promise<RecentAchievement[]> {
	const { body } = await request<RecentAchievement[]>(
		'https://retroachievements.org/API/API_GetUserRecentAchievements.php',
		new URLSearchParams({ m: `${config.retroachievements.pollIntervalMinutes}` }),
	);
	return body;
}

async function fetchUserAchievementsForGame(raGameId: number): Promise<RemoteAchievements> {
	const { body } = await request<RemoteAchievements>(
		'https://retroachievements.org/API/API_GetGameInfoAndUserProgress.php',
		new URLSearchParams({ g: `${raGameId}` }),
	);
	return body;
}

async function addRemoteAchievementsToDatabase(
	session: RaSession,
	localAchievements: Omit<GameAchievement, 'game_id'>[],
) {
	const game = await fetchUserAchievementsForGame(session.raGameId);
	const remoteAchievements = Object.values(game.Achievements);
	let inserted = 0;
	let updated = 0;

	for (const achievement of remoteAchievements) {
		const apiname = `${achievement.ID}`;
		// Find achievement based on apiname, but fallback to name search
		const exists = localAchievements.find(
			local => local.apiname === apiname || local.name === achievement.Title,
		);
		const dateEarned = achievement.DateEarnedHardcore || achievement.DateEarned;
		const achieved = dateEarned !== undefined;
		const created_at = parseDateTime(dateEarned).toISOString();

		if (!exists) {
			insertNewGameAchievement({
				name: achievement.Title,
				description: achievement.Description,
				unlocked_session_id: achieved ? session.session_id : null,
				game_id: session.game_id,
				created_at,
				apiname,
			});
			inserted++;
			continue;
		}

		const updates: Partial<GameAchievement> = {};

		if (exists.unlocked_session_id === null && achieved) {
			updates.unlocked_session_id = session.session_id;
			updates.updated_at = created_at;
		}

		if (exists.apiname === null) {
			updates.apiname = apiname;
		}

		if (Object.keys(updates).length > 0) {
			updateGameAchievement({
				...exists,
				...updates,
			});
			updated++;
		}
	}
	log.warn('Achievement Stuff!!', { inserted, updated });
}

async function updateAchievementsForNewSession(sessions: RaSession[]) {
	const allRecentAchievements = await fetchRecentAchievements();

	for (const session of sessions) {
		const localAchievements = getGameAchievementsForGame(session.game_id);
		const recentAchievements = allRecentAchievements.filter(a => a.GameID === session.raGameId);

		for (const achievement of recentAchievements) {
			const { Title, GameTitle, AchievementID } = achievement;
			const apiname = `${AchievementID}`;
			const existsInDatabase = localAchievements.find(l => l.apiname === apiname || l.name === Title);

			if (!existsInDatabase) {
				log.debug(`Not all achievements stored for '${GameTitle}', fetching now...`);
				addRemoteAchievementsToDatabase(session, localAchievements);
				break;
			}

			updateGameAchievement({
				...existsInDatabase,
				unlocked_session_id: session.session_id,
				updated_at: parseDateTime(achievement.Date).toISOString(),
				apiname,
			});
			log.debug(`Achieved '${Title}' for '${GameTitle}'!`);
		}
	}
}

function parseDateTime(dateTime?: string): Date {
	if (dateTime === undefined) return new Date();

	// eg. 2024-10-13 11:47:54
	const regex = /^(?<date>\d\d\d\d-\d\d-\d\d) (?<time>\d\d:\d\d:\d\d)$/;
	const match = regex.exec(dateTime);
	if (match === null || match.groups === undefined) throw new Error('Not a valid date/time');

	return new Date(`${match.groups.date}T${match.groups.time}Z`);
}

export function pollForRetroAchievementsActivity() {
	const { deviceId, pollIntervalMinutes, apiKey, username } = config.retroachievements;

	const intervalMs = pollIntervalMinutes * minuteMs;
	if (intervalMs === 0 || !(apiKey && username)) {
		log.warn('Polling is disabled, no games will be tracked');
		return;
	}

	const fetchGames = async () => {
		log.info('Polling RetroAchievements for new game activity');
		const recentlyPlayedGames = await fetchRecentlyPlayedGames();
		const recentlyInsertedGames: RaSession[] = [];

		for (const game of recentlyPlayedGames) {
			const lastPlayed = parseDateTime(game.LastPlayed);
			const playTimeMs = intervalMs - (Date.now() - lastPlayed.getTime());
			const playtime_mins = Math.round(playTimeMs / minuteMs);

			if (Date.now() - lastPlayed.getTime() > intervalMs) {
				continue;
			}

			log.info(`Logging '${game.Title}' for ${playtime_mins} minutes`);

			const gameActivity = updateGameSession(
				{
					device_id: deviceId,
					name: game.Title,
					playtime_mins,
					url: `https://retroachievements.org/game/${game.GameID}`,
				},
				intervalMs,
			);

			recentlyInsertedGames.push({
				session_id: gameActivity.id,
				game_id: gameActivity.game_id,
				raGameId: game.GameID,
			});
		}

		if (recentlyInsertedGames.length === 0) return;

		log.debug('New games detected, fetching achievements');

		await updateAchievementsForNewSession(recentlyInsertedGames);
	};

	setInterval(fetchGames, intervalMs);
}
