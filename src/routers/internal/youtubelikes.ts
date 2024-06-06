import express from 'express';
import { getYouTubeVideoSnippet, validateYouTubeUrl } from '../../adapters/youtube.js';
import {
	countYouTubeLikes,
	deleteYouTubeLike,
	getLikes,
	insertYouTubeLike,
	updateYouTubeLike,
} from '../../database/youtubelikes.js';
import { config } from '../../lib/config.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import type { RequestFrontend } from '../../types/express.js';

const router = express.Router();

// FRONTEND

router.get('/', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countYouTubeLikes());

	const youtubelikes = getLikes({ page });

	res.render('internal/youtubelikes', { youtubelikes, pagination });
});

// CRUD

router.post('/', async (req: RequestFrontend, res) => {
	try {
		const { url, created_at } = req.body;
		let { title, channel } = req.body;

		const video_id = validateYouTubeUrl(url);

		if (!(title && channel)) {
			const snippet = await getYouTubeVideoSnippet(url);
			title = snippet?.snippet?.title || '';
			channel = snippet?.snippet?.channelTitle || 'N/A';
		}

		insertYouTubeLike({ video_id, title, channel, device_id: config.defaultDeviceId, created_at });

		res.redirect('/youtubelikes');
	} catch (error) {
		res.status(400).render('internal/error', { error });
	}
});

router.post('/:id', (req: RequestFrontend, res) => {
	const { id } = req.params;
	const { crudType, url, title, channel, created_at } = req.body;
	const video_id = validateYouTubeUrl(url);

	switch (crudType) {
		case 'delete': {
			deleteYouTubeLike(id);
			break;
		}

		case 'update': {
			updateYouTubeLike({ id, video_id, title, channel, created_at });
			break;
		}

		default:
			// Do nothing
			break;
	}

	res.redirect('/youtubelikes');
});

export default router;
