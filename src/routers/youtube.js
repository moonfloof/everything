import express from 'express';
import isLocal from '../lib/isLocal.js';
import { generateAuthUrl, retrieveAccessToken } from '../adapters/youtube.js';
import { validateDevice } from '../database/devices.js';
import { insertYouTubeLike } from '../database/youtubelikes.js';

const router = express.Router();

router.get('/auth', isLocal, (_req, res) => {
	res.redirect(generateAuthUrl());
});

router.get('/callback', isLocal, async (req, res) => {
	await retrieveAccessToken(req.query.code);
	res.redirect('/');
});

router.post('/like', (req, res) => {
	try {
		const { url, title, apiKey } = req.body;
		const { id: deviceId } = validateDevice(apiKey);

		insertYouTubeLike(url, title, 'N/A', deviceId);

		res.send({ status: 'ok' });
	} catch (err) {
		console.error(err);
		res.status(400).send({ status: err.message });
	}
});

export default router;
