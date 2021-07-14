import express from 'express';
import { generateAuthUrl, retrieveAccessToken } from '../adapters/youtube.js';
import { validateDevice } from '../database/devices.js';
import { insertYouTubeLike } from '../database/youtubelikes.js';

const router = express.Router();

const allowedIps = [
	'127.0.0.1',
	'192.168.1.',
];

router.get('/auth', (req, res) => {
	const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
	const matches = allowedIps.find(allow => ip.includes(allow));
	if (matches === undefined) {
		res.redirect('/');
	}
	res.redirect(generateAuthUrl());
});

router.get('/callback', async (req, res) => {
	const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
	const matches = allowedIps.find(allow => ip.includes(allow));
	if (matches === undefined) {
		res.redirect('/');
	}

	await retrieveAccessToken(req.query.code);
	res.redirect('/');
});

router.post('/like', async (req, res) => {
	try {
		const { url, title, apiKey } = req.body;
		const { id: deviceId } = await validateDevice(apiKey);

		await insertYouTubeLike(url, title, 'N/A', deviceId);

		res.send({ status: 'ok' });
	} catch (err) {
		console.error(err);
		res.status(400).send({ status: err.message });
	}
});

export default router;
