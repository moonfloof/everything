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

interface Book {
	crudType?: 'update' | 'delete';
	title: string;
	year: string;
	author: string;
	genre: string;
	pages_total: string;
	pages_progress: string;
	rating: string;
	url: string;
	started_at: string;
	completed_at: string;
	created_at: string;
}

router.post('/', (req: RequestFrontend<object, Book>, res) => {
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

	if (!(title && author && year)) {
		throw new Error('Title, author, and year must all be provided');
	}

	insertBook({
		title,
		author,
		started_at,
		created_at,
		year: Number(year),

		url: url || null,
		genre: genre || null,
		completed_at: completed_at || null,
		rating: rating ? Number(rating) : null,
		pages_total: pages_total ? Number(pages_total) : null,
		pages_progress: pages_progress ? Number(pages_progress) : null,
		device_id: config.defaultDeviceId,
	});

	res.redirect('/books');
});

router.post('/:id', (req: RequestFrontend<object, Book, { id: string }>, res) => {
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
			if (!(title && author && year)) {
				throw new Error('Title, author, and year must all be provided');
			}

			updateBook({
				id,
				title,
				author,
				started_at,
				created_at,
				year: Number(year),

				url: url || null,
				genre: genre || null,
				completed_at: completed_at || null,
				rating: rating ? Number(rating) : null,
				pages_total: pages_total ? Number(pages_total) : null,
				pages_progress: pages_progress ? Number(pages_progress) : null,
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
