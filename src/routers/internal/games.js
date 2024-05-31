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
import handlebarsPagination from '../../lib/handlebarsPagination.js';

const router = express.Router();

// FRONTEND

router.get('/', (req, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countGameActivity());

	const games = getGameActivity({ page });

	res.render('internal/games', { games, pagination });
});

// CRUD

router.post('/', (req, res) => {
	const { name, playtime_mins, url, created_at } = req.body;

	insertNewGameActivity(name, process.env.TOMBOIS_DEFAULT_DEVICE_ID, playtime_mins, url, created_at);
	res.redirect('/games');
});

router.post('/:id', (req, res) => {
	const { id } = req.params;
	const { crudType, name, playtime_mins, url, created_at } = req.body;

	switch (crudType) {
		case 'delete':
			deleteGameActivity(id);
			break;

		case 'update':
			updateGameActivity(id, name, playtime_mins, url, created_at);
			break;

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

router.post('/:game_id/achievements', (req, res) => {
	const { game_id } = req.params;
	const { id, crudType, name, description, created_at } = req.body;

	const [game] = getGameActivity({ id: game_id });

	if (!game) {
		res.redirect(`/games/${game_id}/achievements`);
		return;
	}

	switch (crudType) {
		case 'new':
			insertNewGameAchievement(
				name,
				description,
				game.name,
				game_id,
				process.env.TOMBOIS_DEFAULT_DEVICE_ID,
				created_at,
			);
			break;

		case 'delete':
			deleteGameAchievement(id);
			break;

		case 'update':
			updateGameAchievement(id, name, description, created_at);
			break;

		default:
			// Do nothing
			break;
	}

	res.redirect(`/games/${game_id}/achievements`);
});

export default router;
