import express from 'express';
import {
	countLinkPreviews,
	deleteLinkPreview,
	getLinkPreviews,
	selectOrInsertLinkPreview,
	updateLinkPreview,
} from '../../database/linkpreview.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import { fetchLinkPreview } from '../../lib/linkPreviews.js';
import type { RequestFrontend } from '../../types/express.js';

const router = express.Router();

// FRONTEND

router.get('/', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countLinkPreviews());

	const linkpreviews = getLinkPreviews({ page });

	res.render('internal/linkpreviews', { linkpreviews, pagination });
});

// CRUD

interface LinkPreview {
	crudType?: 'update' | 'delete';
	url: string;
	title: string;
	description: string;
	imageurl?: string;
}

router.post('/', async (req: RequestFrontend<object, LinkPreview>, res) => {
	const { url, title, description, imageurl } = req.body;

	if (!url) {
		throw new Error('URL must be provided');
	}

	const preview = await fetchLinkPreview(
		url,
		title || undefined,
		description || undefined,
		imageurl || undefined,
	);

	selectOrInsertLinkPreview(preview);

	res.redirect('/linkpreviews');
});

router.post('/:url', async (req: RequestFrontend<object, LinkPreview, { url: string }>, res) => {
	const { url } = req.params;
	const { crudType, title, description, imageurl } = req.body;

	if (!url) {
		throw new Error('URL must be provided');
	}

	switch (crudType) {
		case 'delete': {
			deleteLinkPreview(url);
			break;
		}

		case 'update': {
			const preview = await fetchLinkPreview(
				url,
				title || undefined,
				description || undefined,
				imageurl || undefined,
			);
			updateLinkPreview(preview);
			break;
		}

		default:
			// Do nothing
			break;
	}

	res.redirect('/linkpreviews');
});

export default router;
