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

interface Note {
	crudType?: 'update' | 'delete';
	description: string;
	title: string;
	type: string;
	status: string;
	url: string;
	syndication_json: string;
	created_at: string;
	updated_at: string;
}

router.post('/', (req: RequestFrontend<object, Note>, res) => {
	const { description, title, type, status, url, syndication_json, created_at } = req.body;
	insertNote({
		description: description || '',
		title: title || null,
		type: (type as EntryType) || 'note',
		status: (status as EntryStatus) || 'public',
		url: url || null,
		syndication_json: syndication_json || null,
		created_at: created_at,
		device_id: config.defaultDeviceId,
	});

	res.redirect('/notes');
});

router.post('/:id', (req: RequestFrontend<object, Note, { id: string }>, res) => {
	const { id } = req.params;
	const { crudType, description, title, type, status, url, syndication_json, created_at, updated_at } = req.body;

	switch (crudType) {
		case 'delete': {
			deleteNote(id);
			break;
		}

		case 'update': {
			updateNote({
				id,
				description: description || '',
				title: title || null,
				type: (type as EntryType) || 'note',
				status: (status as EntryStatus) || 'public',
				url: url || null,
				syndication_json: syndication_json?.replace(/\t+/g, '') || null,
				created_at: created_at,
				updated_at: updated_at,
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
