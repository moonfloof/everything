import { v4 as uuid } from 'uuid';
import { timeago } from '../adapters/timeago.js';
import { dateDefault } from '../lib/formatDate.js';
import type { Insert, Optional, Update } from '../types/database.js';
import { type Parameters, calculateGetParameters } from './constants.js';
import { getStatement } from './database.js';

export const ENTRY_TYPES = {
	note: '💬',
	post: '📰',
	audio: '🎵',
	video: '🎥',
	photo: '📸',
} as const;

export const entryTypeValues = Object.keys(ENTRY_TYPES);

export const ENTRY_STATUS = {
	PUBLIC: 'public',
	PRIVATE: 'private',
} as const;

export const entryStatusValues = Object.values(ENTRY_STATUS);

export type EntryType = keyof typeof ENTRY_TYPES;
export type EntryStatus = (typeof ENTRY_STATUS)[keyof typeof ENTRY_STATUS];

interface Entry {
	id: string;
	title: Optional<string>;
	description: string;
	type: EntryType;
	status: EntryStatus;
	url: Optional<string>;
	syndication_json: Optional<string>;
	created_at: string;
	updated_at: string;
	device_id: string;
}

export function insertNote(note: Insert<Entry>) {
	const statement = getStatement(
		'insertNote',
		`INSERT INTO entries
		(id, description, title, type, status, url, syndication_json, created_at, updated_at, device_id)
		VALUES
		($id, $description, $title, $type, $status, $url, $syndication_json, $created_at, $updated_at, $device_id)`,
	);

	return statement.run({
		...note,
		id: uuid(),
		created_at: dateDefault(note.created_at),
		updated_at: new Date().toISOString(),
	});
}

export function countNotes(status: EntryStatus | '%' = ENTRY_STATUS.PUBLIC) {
	const statement = getStatement<{ total: number }>(
		'countNotes',
		'SELECT COUNT(*) as total FROM entries WHERE status LIKE $status',
	);

	return statement.get({ status: status || '%' })?.total || 0;
}

export function getNotes(parameters: Partial<Parameters & { status: EntryStatus | '%' }> = {}) {
	const statement = getStatement<Entry>(
		'getNotes',
		`SELECT * FROM entries
		WHERE id LIKE $id AND status LIKE $status AND created_at >= $created_at
		ORDER BY created_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement
		.all({
			...calculateGetParameters(parameters),
			status: parameters.status || 'public',
		})
		.map(row => {
			let syndication = null;
			if (row.syndication_json) {
				try {
					syndication = JSON.parse(row.syndication_json);
				} catch (err) {
					console.warn(`Invalid JSON for note with ID '${row.id}'`);
				}
			}

			return {
				...row,
				emoji: ENTRY_TYPES[row.type || 'note'],
				timeago: timeago.format(new Date(row.created_at)),
				syndication,

				// ⚠ Note: I would not normally rely on regex like this.
				// It's unsafe, but considering the *only* content
				// stored in notes is content I've generated myself, I
				// didn't mind in this specific instance.
				summary: row.description.replace(/<[^>]+?>/g, ''),
			};
		});
}

export function deleteNote(id: string) {
	const statement = getStatement('deleteNote', 'DELETE FROM entries WHERE id = $id');

	return statement.run({ id });
}

export function updateNote(note: Update<Entry>) {
	const statement = getStatement(
		'updateNote',
		`UPDATE entries
		SET title = $title,
		    description = $description,
		    type = $type,
		    status = $status,
		    url = $url,
		    syndication_json = $syndication_json,
		    created_at = $created_at,
		    updated_at = $updated_at
		WHERE id = $id`,
	);

	return statement.run({
		...note,
		created_at: dateDefault(note.created_at),
		updated_at: note.updated_at || new Date().toISOString(),
	});
}
