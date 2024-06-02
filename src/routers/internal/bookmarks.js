import express from 'express';
import {
	countBookmarks,
	deleteBookmark,
	getBookmarks,
	insertBookmark,
	updateBookmark,
} from '../../database/bookmarks.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';

const router = express.Router();

// FRONTEND

router.get('/', (req, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countBookmarks());

	const bookmarks = getBookmarks({ page });

	res.render('internal/bookmarks', { bookmarks, pagination });
});

// CRUD

router.post('/', (req, res) => {
	const { url, title, created_at } = req.body;

	insertBookmark(title, url, process.env.TOMBOIS_DEFAULT_DEVICE_ID, created_at);

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
			updateBookmark(id, title, url, created_at);
			break;
		}

		default:
			// Do nothing
			break;
	}

	res.redirect('/bookmarks');
});

export default router;
