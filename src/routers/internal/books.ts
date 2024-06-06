import express from 'express';
import { countBooks, deleteBook, getBooks, insertBook, updateBook } from '../../database/books.js';
import { config } from '../../lib/config.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import type { RequestFrontend } from '../../types/express.js';

const router = express.Router();

// FRONTEND

router.get('/', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countBooks());

	if (!(typeof page === 'string' || typeof page === 'number')) {
		throw new Error('Invalid page parameter');
	}

	const books = getBooks({ page });

	res.render('internal/books', { books, pagination });
});

// CRUD

router.post('/', (req: RequestFrontend, res) => {
	const {
		title,
		year,
		author,
		genre,
		pages_total,
		pages_progress,
		rating,
		url,
		started_at,
		completed_at,
		created_at,
	} = req.body;

	insertBook({
		title,
		year: Number(year || 0),
		rating: rating ? Number(rating) : null,
		url,
		author,
		genre,
		pages_total: pages_total ? Number(pages_total) : null,
		pages_progress: pages_progress ? Number(pages_progress) : null,
		started_at,
		completed_at,
		created_at,
		device_id: config.defaultDeviceId,
	});

	res.redirect('/books');
});

router.post('/:id', (req, res) => {
	const { id } = req.params;
	const {
		crudType,
		title,
		year,
		author,
		genre,
		pages_total,
		pages_progress,
		rating,
		url,
		started_at,
		completed_at,
		created_at,
	} = req.body;

	switch (crudType) {
		case 'delete': {
			deleteBook(id);
			break;
		}

		case 'update': {
			updateBook({
				id,
				title,
				year: Number(year || 0),
				rating: rating ? Number(rating) : null,
				url,
				author,
				genre,
				pages_total: pages_total ? Number(pages_total) : null,
				pages_progress: pages_progress ? Number(pages_progress) : null,
				started_at,
				completed_at,
				created_at,
			});
			break;
		}

		default:
			// Do nothing
			break;
	}

	res.redirect('/books');
});

export default router;
