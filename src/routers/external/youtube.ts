import express from 'express';
import { getYouTubeVideoSnippet } from '../../adapters/youtube.js';
import { validateDevice } from '../../database/devices.js';
import { insertYouTubeLike } from '../../database/youtubelikes.js';
import { isoDurationToSeconds } from '../../lib/formatDate.js';
import Logger from '../../lib/logger.js';
import type { RequestFrontend } from '../../types/express.js';

const log = new Logger('YouTube');

const router = express.Router();

router.post('/like', async (req: RequestFrontend, res) => {
	try {
		const { url, title, created_at, apiKey } = req.body;
		const { id: device_id } = validateDevice(apiKey);

		const details = await getYouTubeVideoSnippet(url);

		insertYouTubeLike({
			video_id: details.id as string,
			title: title || details.snippet?.title || '',
			channel: details.snippet?.channelTitle || 'N/A',
			duration_secs: isoDurationToSeconds(details.contentDetails?.duration),
			device_id,
			created_at,
		});

		res.send({ status: 'ok' });
	} catch (err) {
		log.error(err);
		res.status(400).send({ status: (err as Error).message });
	}
});

export default router;
