import express from 'express';
import { countYouTubeLikes, getLikes, deleteYouTubeLike, updateYouTubeLike, insertYouTubeLike } from '../../database/youtubelikes.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import { getYouTubeVideoSnippet, validateYouTubeUrl } from '../../adapters/youtube.js';

const router = express.Router();

// FRONTEND

router.get('/', (req, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countYouTubeLikes());

	const youtubelikes = getLikes({ page });

	res.render('internal/youtubelikes', { youtubelikes, pagination });
});

// CRUD

router.post('/', async (req, res) => {
	const { url, created_at } = req.body;
	let { title, channel } = req.body;

	const id = validateYouTubeUrl(url);

	if (!title || !channel) {
		const snippet = await getYouTubeVideoSnippet(url);
		title = snippet?.snippet?.title;
		channel = snippet?.snippet?.channelTitle || 'N/A';
	}

	insertYouTubeLike(
		id,
		title,
		channel,
		process.env.TOMBOIS_DEFAULT_DEVICE_ID,
		created_at,
	);

	res.redirect('/youtubelikes');
});

router.post('/:id', (req, res) => {
	const { id } = req.params;
	const { crudType, url, title, channel, created_at } = req.body;
	const videoId = validateYouTubeUrl(url);

	switch (crudType) {
		case 'delete':
			deleteYouTubeLike(id);
			break;

		case 'update':
			updateYouTubeLike(id, videoId, title, channel, created_at);
			break;

		default:
			// Do nothing
			break;
	}

	res.redirect('/youtubelikes');
});

export default router;
