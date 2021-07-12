import express from 'express';
import { getListens } from '../database/listens.js';
import { getLikes } from '../database/youtubelikes.js';

const router = express.Router();

router.get('/', async (req, res) => {
	try {
		const [ listens, youtubelikes ] = await Promise.all([
			getListens(),
			getLikes(),
		]);

		res.send({
			listen: listens[0] || null,
			youtubelike: youtubelikes[0] || null,
		});
	} catch (err) {
		res.status(400).send({
			status: 'error',
			error: err.message,
		});
	}
});

export default router;
