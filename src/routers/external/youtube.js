import express from 'express';
import { generateAuthUrl, getYouTubeVideoSnippet, retrieveAccessToken } from '../../adapters/youtube.js';
import { validateDevice } from '../../database/devices.js';
import { insertYouTubeLike } from '../../database/youtubelikes.js';
import Logger from '../../lib/logger.js';
import isLocal from '../../lib/middleware/isLocal.js';

const log = new Logger('YouTube');

const router = express.Router();

router.get('/auth', isLocal, (_req, res) => {
	res.redirect(generateAuthUrl());
});

router.get('/callback', isLocal, async (req, res) => {
	await retrieveAccessToken(req.query.code);
	res.redirect('/');
});

router.post('/like', async (req, res) => {
	try {
		const { url, title, apiKey } = req.body;
		const { id: deviceId } = validateDevice(apiKey);

		const details = await getYouTubeVideoSnippet(url);

		insertYouTubeLike(
			details?.id,
			details?.snippet?.title || title,
			details?.snippet?.channelTitle || 'N/A',
			deviceId,
		);

		res.send({ status: 'ok' });
	} catch (err) {
		log.error(err);
		res.status(400).send({ status: err.message });
	}
});

export default router;
