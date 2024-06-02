import express from 'express';
import { countBooks, deleteBook, getBooks, insertBook, updateBook } from '../../database/books.js';
import { formatDate } from '../../lib/formatDate.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';

const router = express.Router();

// FRONTEND

router.get('/', (req, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countBooks());

	const books = getBooks({ page });

	res.render('internal/books', { books, pagination });
});

// CRUD

router.post('/', (req, res) => {
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
		year: Number(year),
		rating: rating ? Number(rating) : null,
		url,
		author,
		genre,
		pages_total: pages_total ? Number(pages_total) : null,
		pages_progress: pages_progress ? Number(pages_progress) : null,
		started_at,
		completed_at,
		created_at,
		device_id: process.env.TOMBOIS_DEFAULT_DEVICE_ID,
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

	// Auto-complete book if pages match
	const completed_calculated = completed_at
		? completed_at
		: pages_progress === pages_total
			? formatDate(new Date())
			: null;

	switch (crudType) {
		case 'delete': {
			deleteBook(id);
			break;
		}

		case 'update': {
			updateBook(id, {
				title,
				year: Number(year),
				rating: rating ? Number(rating) : null,
				url,
				author,
				genre,
				pages_total: pages_total ? Number(pages_total) : null,
				pages_progress: pages_progress ? Number(pages_progress) : null,
				started_at,
				completed_at: completed_calculated,
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
