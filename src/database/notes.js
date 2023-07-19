import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import { calculateOffset, RECORDS_PER_PAGE } from './constants.js';
import timeago from '../adapters/timeago.js';

export const entryTypeValues = [
	'note',
	'post',
	'audio',
	'video',
	'photo',
];

export const entryTypeEmojiMap = {
	note: '💬',
	post: '📰',
	audio: '🎵',
	video: '🎥',
	photo: '📸',
};

export const entryStatusValues = [
	'private',
	'public',
];

export function insertNote (
	description,
	title = null,
	type = 'note',
	status = 'public',
	url = null,
	syndication_json = null,
	created_at = null,
	updated_at = new Date().toISOString(),
	device_id = process.env.TOMBOIS_DEFAULT_DEVICE_ID,
) {
	const statement = getStatement(
		'insertNote',
		`INSERT INTO entries
		(id, description, title, type, status, url, syndication_json, created_at, updated_at, device_id)
		VALUES
		($id, $description, $title, $type, $status, $url, $syndication_json, $created_at, $updated_at, $device_id)`,
	);

	return statement.run({
		id: uuid(),
		description,
		title,
		type,
		status,
		url,
		syndication_json,
		created_at,
		updated_at,
		device_id,
	});
}

export function countNotes (status = 'public') {
	const statement = getStatement(
		'countNotes',
		'SELECT COUNT(*) as total FROM entries WHERE status LIKE $status',
	);

	return statement.get({ status: status || '%' }).total;
}

export function getNotes (id, page, status = 'public') {
	const statement = getStatement(
		'getNotes',
		`SELECT * FROM entries
		WHERE id LIKE $id AND status LIKE $status
		ORDER BY created_at DESC
		LIMIT ${RECORDS_PER_PAGE} OFFSET $offset`,
	);

	return statement
		.all({
			id: id || '%',
			status: status || '%',
			offset: calculateOffset(page),
		})
		.map(row => ({
			...row,
			emoji: entryTypeEmojiMap[row.type || 'note'],
			summary: row.description.replace(/<[^>]+?>/g, ''),
			timeago: timeago.format(new Date(row.created_at)),
		}));
}

export function deleteNote (id) {
	const statement = getStatement(
		'deleteNote',
		'DELETE FROM entries WHERE id = $id',
	);

	return statement.run({ id });
}

export function updateNote (
	id,
	description,
	title,
	type,
	status,
	url,
	syndication_json,
	created_at,
	updated_at = new Date().toISOString(),
) {
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
		id,
		title,
		description,
		type,
		status,
		url,
		syndication_json,
		created_at,
		updated_at,
	});
}
