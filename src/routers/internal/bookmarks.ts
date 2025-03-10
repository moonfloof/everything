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
	const { page = 0, title, url } = req.query;
	const pagination = handlebarsPagination(page, countBookmarks());

	const bookmarks = getBookmarks({ page });

	res.render('internal/bookmarks', { bookmarks, pagination, bookmark: { title, url } });
});

// CRUD

interface Bookmark {
	crudType?: 'update' | 'delete';
	url: string;
	title: string;
	created_at: string;
}

router.post('/', (req: RequestFrontend<object, Bookmark>, res) => {
	const { url, title, created_at } = req.body;

	if (!(url && title)) {
		throw new Error('URL and title must be provided');
	}

	insertBookmark({ title, url, created_at: created_at || '', device_id: config.defaultDeviceId });

	res.redirect('/bookmarks');
});

router.post('/:id', (req: RequestFrontend<object, Bookmark, { id: string }>, res) => {
	const { id } = req.params;
	const { crudType, url, title, created_at } = req.body;

	if (!(url && title)) {
		throw new Error('URL and title must be provided');
	}

	switch (crudType) {
		case 'delete': {
			deleteBookmark(id);
			break;
		}

		case 'update': {
			updateBookmark({ id, title, url, created_at: created_at || '' });
			break;
		}

		default:
			// Do nothing
			break;
	}

	res.redirect('/bookmarks');
});

export default router;
