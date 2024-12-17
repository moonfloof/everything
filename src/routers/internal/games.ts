import express from 'express';
import { addRemoteRetroAchievementsToDatabase } from '../../adapters/retroachievements.js';
import { updateSteamAchievementsDatabase } from '../../adapters/steam.js';
import {
	countGames,
	deleteGameEntirely,
	getAchievementsForGame,
	getGameById,
	getGames,
	getGamesAsOptions,
	getSessionsForGame,
	selectOrInsertGame,
	updateGame,
} from '../../database/game.js';
import {
	deleteGameAchievement,
	getGameAchievement,
	insertNewGameAchievement,
	updateGameAchievement,
} from '../../database/gameachievements.js';
import {
	countGameSessions,
	deleteGameSession,
	getGameSessions,
	insertGameSession,
	updateGameSessionInternal,
} from '../../database/gamesession.js';
import { config } from '../../lib/config.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import type { RequestFrontend } from '../../types/express.js';
import { searchForImages } from '../../adapters/steamgriddb.js';

const router = express.Router();

// Games

router.get('/', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countGames());

	const games = getGames({ page });

	res.render('internal/games', { games, pagination, page });
});

router.post('/game', (req: RequestFrontend, res) => {
	const { name, url } = req.body;

	selectOrInsertGame({ name, url });

	res.redirect('/games');
});

router.post('/game/:game_id', (req: RequestFrontend, res) => {
	const { game_id } = req.params;
	const game = getGameById(game_id);
	if (!game) {
		res.redirect('/games');
		return;
	}
	const { name, url, crudType } = req.body;

	switch (crudType) {
		case 'delete': {
			deleteGameEntirely(game.id);
			break;
		}

		case 'update': {
			updateGame({
				...game,
				name,
				url,
			});
			break;
		}
	}

	res.redirect('/games');
});

router.get('/game/update-images/:game_id', async (req: RequestFrontend, res) => {
	const { game_id } = req.params;
	const game = getGameById(game_id);

	const redirect = (): void => {
		const page = req.query.page;
		let url = '/games';
		if (page) url += `?page=${page}`;
		if (game) url += `#game-${game.id}`;
		res.redirect(url);
	};

	if (!game) return redirect();

	await searchForImages(game.name, game);

	redirect();
});

router.get('/game/update-achievements/:game_id', async (req: RequestFrontend, res) => {
	const { game_id } = req.params;
	const game = getGameById(game_id);

	const redirect = (): void => {
		const page = req.query.page;
		let url = '/games';
		if (page) url += `?page=${page}`;
		if (game) url += `#game-${game.id}`;
		res.redirect(url);
	};

	if (!game || game.url === null) return redirect();

	// TODO: Figure out how to get PSN game ID for API? Looks difficult given the store URLs...
	const stores = {
		steam: new RegExp(/store\.steampowered\.com\/app\/([0-9]+)/),
		retroachievements: new RegExp(/retroachievements\.org\/game\/([0-9]+)/),
	} as const;

	let matchingStore: { appid: number; store: string } | null = null;

	for (const [store, regex] of Object.entries(stores)) {
		const match = game.url.match(regex);
		if (!match) continue;

		matchingStore = {
			appid: Number(match[1]),
			store,
		};
		break;
	}

	if (matchingStore === null) return redirect();

	const oldestSession = getSessionsForGame(game.id, 'ASC')[0];

	if (!oldestSession) return redirect();

	switch (matchingStore.store) {
		case 'steam': {
			await updateSteamAchievementsDatabase(matchingStore.appid, oldestSession);
			break;
		}

		case 'retroachievements': {
			const achievements = getAchievementsForGame(game.id);
			await addRemoteRetroAchievementsToDatabase(
				{ game_id: game.id, raGameId: matchingStore.appid, session_id: oldestSession.id },
				achievements,
			);
			break;
		}
	}

	return redirect();
});

router.get('/:id/sessions', (req: RequestFrontend, res) => {
	const { id } = req.params;
	const game = getGameById(id);
	if (!game) {
		res.redirect('/games');
		return;
	}

	const sessions = getSessionsForGame(game.id);
	const title = `Editing game sessions for '${game.name}'`;
	const backUrl = '/games';

	res.render('internal/game-sessions', { sessions, gameId: id, title, backUrl });
});

router.get('/:id/achievements', (req: RequestFrontend, res) => {
	const { id } = req.params;
	const game = getGameById(id);
	if (!game) {
		res.redirect('/games');
		return;
	}

	const achievements = getAchievementsForGame(game.id);
	const title = `Editing achievements for '${game.name}'`;
	const backUrl = '/games';

	res.render('internal/game-achievements', { game, achievements, title, backUrl });
});

// Modify Achievements

router.get('/session/achievements/:id', (req, res) => {
	const { id } = req.params;

	const [session] = getGameSessions({ id });
	const title = 'Game Achievements';
	const backUrl = '/games/session';

	if (!session) {
		res.redirect(backUrl);
		return;
	}

	res.render('internal/game-achievements', { id, title, backUrl, session, achievements: session.achievements });
});

router.post('/session/achievements', (req: RequestFrontend, res) => {
	const { game_id, id, crudType, name, description, apiname, created_at, updated_at } = req.body;

	const game = getGameById(game_id);
	if (!game) {
		res.redirect('/games');
		return;
	}
	const achievement = getGameAchievement({ id, limit: 1 })?.[0] ?? {};

	switch (crudType) {
		case 'new': {
			insertNewGameAchievement({
				name,
				description,
				apiname,
				created_at,
				updated_at,
				game_id: game.id,
				unlocked_session_id: null,
			});
			break;
		}

		case 'delete': {
			deleteGameAchievement(id);
			break;
		}

		case 'update': {
			updateGameAchievement({
				...achievement,
				id,
				name,
				description,
				created_at,
				updated_at,
				apiname,
			});
			break;
		}

		default:
			// Do nothing
			break;
	}

	res.redirect(`/games/${game.id}/achievements`);
});

router.post('/session/achievements/:unlocked_session_id', (req: RequestFrontend, res) => {
	const { unlocked_session_id } = req.params;
	const { id, crudType, name, description, created_at, updated_at, apiname } = req.body;

	const [session] = getGameSessions({ id: unlocked_session_id });

	if (!session) {
		res.redirect(`/games/${unlocked_session_id}/achievements`);
		return;
	}

	switch (crudType) {
		case 'new': {
			insertNewGameAchievement({
				name,
				description,
				game_id: session.game_id,
				unlocked_session_id,
				created_at,
				updated_at,
				apiname,
			});
			break;
		}

		case 'delete': {
			deleteGameAchievement(id);
			break;
		}

		case 'update': {
			updateGameAchievement({
				id,
				name,
				description,
				created_at,
				updated_at,
				apiname,
				unlocked_session_id,
			});
			break;
		}

		default:
			// Do nothing
			break;
	}

	res.redirect(`/games/session/achievements/${unlocked_session_id}`);
});

// Game Sessions

router.get('/session', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countGameSessions());

	const gameOptions = getGamesAsOptions();
	const sessions = getGameSessions({ page });
	const title = 'Game Sessions';
	const backUrl = '/';

	res.render('internal/game-sessions', { sessions, pagination, title, backUrl, gameOptions });
});

router.post('/session', (req: RequestFrontend, res) => {
	const { game_id, game_page, playtime_mins, created_at } = req.body;
	let { name } = req.body;
	let redirectUri = '/games/session';

	if (game_id) {
		const game = getGameById(game_id);
		if (game !== undefined) {
			name = game.name;
		}
	}

	if (game_page !== undefined) {
		redirectUri = `/games/${game_id}/sessions`;
	}

	insertGameSession({
		name,
		url: null,

		playtime_mins: Number(playtime_mins || 0),
		device_id: config.defaultDeviceId,
		created_at,
	});

	res.redirect(redirectUri);
});

router.post('/session/:id', (req: RequestFrontend, res) => {
	const { id } = req.params;

	const { crudType, playtime_mins, created_at, updated_at, game_id, game_page } = req.body;
	let { name } = req.body;
	let redirectUri = '/games/session';

	if (game_id) {
		const game = getGameById(game_id);
		if (game) {
			name = game.name;
		}
	}

	if (game_page !== undefined) {
		redirectUri = `/games/${game_id}/sessions`;
	}

	switch (crudType) {
		case 'delete': {
			deleteGameSession(id);
			break;
		}

		case 'update': {
			updateGameSessionInternal({
				id,
				name,
				url: null,
				playtime_mins: Number(playtime_mins || 0),
				created_at,
				updated_at,
			});
			break;
		}
	}

	res.redirect(redirectUri);
});

export default router;
