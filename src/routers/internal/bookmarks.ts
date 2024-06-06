import express from 'express';
import {
	countBookmarks,
	deleteBookmark,
	getBookmarks,
	insertBookmark,
	updateBookmark,
} from '../../database/bookmarks.js';
import { config } from '../../lib/config.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import type { RequestFrontend } from '../../types/express.js';

const router = express.Router();

// FRONTEND

router.get('/', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countBookmarks());

	const bookmarks = getBookmarks({ page });

	res.render('internal/bookmarks', { bookmarks, pagination });
});

// CRUD

router.post('/', (req: RequestFrontend, res) => {
	const { url, title, created_at } = req.body;

	insertBookmark({ title, url, created_at, device_id: config.defaultDeviceId });

	res.redirect('/bookmarks');
});

router.post('/:id', (req, res) => {
	const { id } = req.params;
	const { crudType, url, title, created_at } = req.body;

	switch (crudType) {
		case 'delete': {
			deleteBookmark(id);
			break;
		}

		case 'update': {
			updateBookmark({ id, title, url, created_at });
			break;
		}

		default:
			// Do nothing
			break;
	}

	res.redirect('/bookmarks');
});

export default router;
