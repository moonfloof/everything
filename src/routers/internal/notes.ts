import express from 'express';

import {
	type EntryStatus,
	type EntryType,
	countNotes,
	deleteNote,
	entryStatusValues,
	entryTypeValues,
	getNotes,
	insertNote,
	updateNote,
} from '../../database/notes.js';
import { config } from '../../lib/config.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import type { RequestFrontend } from '../../types/express.js';

const router = express.Router();

// FRONTEND

router.get('/', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countNotes('%'));

	const notes = getNotes({ page, status: '%' });

	res.render('internal/notes', { notes, pagination, entryTypeValues, entryStatusValues });
});

// CRUD

router.post('/', (req: RequestFrontend, res) => {
	insertNote({
		description: req.body.description,
		title: req.body.title || null,
		type: (req.body.type as EntryType) || 'note',
		status: (req.body.status as EntryStatus) || 'public',
		url: req.body.url || null,
		syndication_json: req.body.syndication_json || null,
		created_at: req.body.created_at,
		device_id: config.defaultDeviceId,
	});

	res.redirect('/notes');
});

router.post('/:id', (req: RequestFrontend, res) => {
	const { id } = req.params;

	switch (req.body.crudType) {
		case 'delete': {
			deleteNote(id);
			break;
		}

		case 'update': {
			updateNote({
				id,
				description: req.body.description,
				title: req.body.title || null,
				type: (req.body.type as EntryType) || 'note',
				status: (req.body.status as EntryStatus) || 'public',
				url: req.body.url || null,
				syndication_json: req.body.syndication_json?.replace(/\t+/g, '') || null,
				created_at: req.body.created_at,
			});
			break;
		}

		default:
			// Do nothing
			break;
	}

	res.redirect('/notes');
});

export default router;
