import express from 'express';
import {
	deleteGameAchievement,
	insertNewGameAchievement,
	updateGameAchievement,
} from '../../database/gameachievements.js';
import {
	countGameActivity,
	deleteGameActivity,
	getGameActivity,
	insertNewGameActivity,
	updateGameActivity,
} from '../../database/games.js';
import { config } from '../../lib/config.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import type { RequestFrontend } from '../../types/express.js';

const router = express.Router();

// FRONTEND

router.get('/', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countGameActivity());

	const games = getGameActivity({ page });

	res.render('internal/games', { games, pagination });
});

// CRUD

router.post('/', (req: RequestFrontend, res) => {
	const { name, playtime_mins, url, created_at } = req.body;

	insertNewGameActivity({
		name,
		device_id: config.defaultDeviceId,
		playtime_mins: Number(playtime_mins || 0),
		url,
		created_at,
	});
	res.redirect('/games');
});

router.post('/:id', (req: RequestFrontend, res) => {
	const { id } = req.params;
	const { crudType, name, playtime_mins, url, created_at } = req.body;

	switch (crudType) {
		case 'delete': {
			deleteGameActivity(id);
			break;
		}

		case 'update': {
			updateGameActivity({ id, name, playtime_mins: Number(playtime_mins || 0), url, created_at });
			break;
		}

		default:
			// Do nothing
			break;
	}

	res.redirect('/games');
});

// Modify Achievements

router.get('/:id/achievements', (req, res) => {
	const { id } = req.params;

	const [game] = getGameActivity({ id });

	if (!game) {
		res.redirect('/games');
		return;
	}

	res.render('internal/game-achievements', { id, game, achievements: game.achievements.length });
});

router.post('/:game_id/achievements', (req: RequestFrontend, res) => {
	const { game_id } = req.params;
	const { id, crudType, name, description, created_at } = req.body;

	const [game] = getGameActivity({ id: game_id });

	if (!game) {
		res.redirect(`/games/${game_id}/achievements`);
		return;
	}

	switch (crudType) {
		case 'new': {
			insertNewGameAchievement({
				name,
				description,
				game_name: game.name,
				game_id,
				device_id: config.defaultDeviceId,
				created_at,
			});
			break;
		}

		case 'delete': {
			deleteGameAchievement(id);
			break;
		}

		case 'update': {
			updateGameAchievement({ id, name, description, created_at });
			break;
		}

		default:
			// Do nothing
			break;
	}

	res.redirect(`/games/${game_id}/achievements`);
});

export default router;
