import phin from 'phin';
import { insertNewGameAchievement } from '../database/gameachievements.js';
import { updateActivity } from '../database/games.js';
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

async function fetchRecentlyPlayedGames(): Promise<RecentlyPlayedGame[]> {
	const { body } = await request<RecentlyPlayedGame[]>(
		'https://retroachievements.org/API/API_GetUserRecentlyPlayedGames.php',
	);
	return body;
}

async function fetchRecentAchievements(): Promise<RecentAchievement[]> {
	const { body } = await request<RecentAchievement[]>(
		'https://retroachievements.org/API/API_GetUserRecentAchievements.php',
		new URLSearchParams({ m: `${config.retroachievements.pollInterval}` }),
	);
	return body;
}

function parseDateTime(dateTime: string): Date {
	// eg. 2024-10-13 11:47:54
	const regex = /^(?<date>\d\d\d\d-\d\d-\d\d) (?<time>\d\d:\d\d:\d\d)$/;
	const match = regex.exec(dateTime);
	if (match === null || match.groups === undefined) throw new Error('Not a valid date/time');

	return new Date(`${match.groups.date}T${match.groups.time}Z`);
}

export function pollForRetroAchievementsActivity() {
	const { deviceId, pollInterval, apiKey, username } = config.retroachievements;
	const insertDeviceId = deviceId || config.defaultDeviceId;

	const intervalMs = pollInterval * minuteMs;
	if (intervalMs === 0 || !(apiKey && username)) {
		log.warn('Polling is disabled, no games will be tracked');
		return;
	}

	const fetchGames = async () => {
		log.info('Polling RetroAchievements for new game activity');
		const recentlyPlayedGames = await fetchRecentlyPlayedGames();
		const recentlyInsertedGames: { id: string; gameId: number }[] = [];

		for (const game of recentlyPlayedGames) {
			const lastPlayed = parseDateTime(game.LastPlayed);
			const playTimeMs = intervalMs - (Date.now() - lastPlayed.getTime());
			const playtime_mins = Math.round(playTimeMs / minuteMs);

			if (Date.now() - lastPlayed.getTime() > intervalMs) {
				continue;
			}

			log.info(`Logging '${game.Title}' for ${playtime_mins} minutes`);

			const gameActivity = updateActivity(
				{
					device_id: insertDeviceId,
					name: game.Title,
					playtime_mins,
					url: `https://retroachievements.org/game/${game.GameID}`,
				},
				intervalMs,
			);

			recentlyInsertedGames.push({
				id: gameActivity.id,
				gameId: game.GameID,
			});
		}

		if (recentlyInsertedGames.length === 0) return;

		log.debug('New games detected, fetching achievements');

		const recentAchievements = await fetchRecentAchievements();

		for (const achievement of recentAchievements) {
			const game = recentlyInsertedGames.find(game => game.gameId === achievement.GameID);

			// NOTE: Achievement found for a game not recently played?
			if (!game) continue;

			log.debug(`Achieved '${achievement.Title}' for '${achievement.GameTitle}'!`);

			insertNewGameAchievement({
				name: achievement.Title,
				description: achievement.Description,
				created_at: parseDateTime(achievement.Date).toISOString(),
				device_id: insertDeviceId,
				game_id: game.id,
				game_name: achievement.GameTitle,
			});
		}
	};

	setInterval(fetchGames, intervalMs);
}
