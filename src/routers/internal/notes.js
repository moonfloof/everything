import express from 'express';

import {
	countNotes,
	deleteNote,
	getNotes,
	insertNote,
	updateNote,
	entryTypeValues,
	entryStatusValues,
} from '../../database/notes.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import { validatePageNumber } from '../../lib/middleware/validatePageNumber.js';

const router = express.Router();

// FRONTEND

router.get('/', validatePageNumber(true), (req, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countNotes('%'));

	const notes = getNotes({ page, status: '%' });

	res.render('internal/notes', { notes, pagination, entryTypeValues, entryStatusValues });
});

// CRUD

router.post('/', (req, res) => {
	insertNote(
		req.body.description,
		req.body.title || null,
		req.body.type || 'note',
		req.body.status || 'public',
		req.body.url || null,
		req.body.syndication_json,
		req.body.created_at || new Date().toISOString(),
	);

	res.redirect('/notes');
});

router.post('/:entryId', (req, res) => {
	const { entryId } = req.params;

	switch (req.body.crudType) {
		case 'delete':
			deleteNote(entryId);
			break;

		case 'update':
			updateNote(
				entryId,
				req.body.description,
				req.body.title || null,
				req.body.type || 'note',
				req.body.status || 'public',
				req.body.url || null,
				req.body.syndication_json?.replace(/\t+/g, '') || null,
				req.body.created_at,
				req.body.updated_at,
			);
			break;

		default:
			// Do nothing
			break;
	}

	res.redirect('/notes');
});

export default router;
