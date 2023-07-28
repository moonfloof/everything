import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import { calculateGetParameters } from './constants.js';
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
	'public',
	'private',
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

/**
 * @param {object} parameters
 * @param {string} [parameters.id]
 * @param {string} [parameters.status]
 * @param {number} [parameters.page]
 * @param {number} [parameters.limit]
 * @param {number} [parameters.days]
 */
export function getNotes (parameters) {
	const statement = getStatement(
		'getNotes',
		`SELECT * FROM entries
		WHERE id LIKE $id AND status LIKE $status AND created_at >= $created_at
		ORDER BY created_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement
		.all({
			...calculateGetParameters(parameters),
			status: parameters?.status || 'public',
		})
		.map(row => ({
			...row,
			emoji: entryTypeEmojiMap[row.type || 'note'],
			timeago: timeago.format(new Date(row.created_at)),
			syndication: row.syndication_json ? JSON.parse(row.syndication_json) : null,

			// ⚠ Note: I would not normally rely on regex like this.
			// It's unsafe, but considering the *only* content stored in
			// notes is content I've generated myself, I didn't mind
			// in this specific instance.
			summary: row.description.replace(/<[^>]+?>/g, ''),
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
