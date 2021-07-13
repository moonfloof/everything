import express from 'express';
import { validateDevice } from '../database/devices.js';
import { insertYouTubeLike } from '../database/youtubelikes.js';

const router = express.Router();

router.post('/like', async (req, res) => {
	try {
		const { url, title, apiKey } = req.body;
		const { id: deviceId } = await validateDevice(apiKey);

		await insertYouTubeLike(url, title, deviceId);

		res.send({ status: 'ok' });
	} catch (err) {
		console.error(err);
		res.status(400).send({ status: err.message });
	}
});

export default router;
