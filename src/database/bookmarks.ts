import { v4 as uuid } from 'uuid';
import { dateDefault } from '../lib/formatDate.js';
import type { Insert, Update } from '../types/database.js';
import { type Parameters, calculateGetParameters } from './constants.js';
import { getStatement } from './database.js';

interface Bookmark {
	id: string;
	title: string;
	url: string;
	device_id: string;
	created_at: string;
}

export function insertBookmark(bookmark: Insert<Bookmark>) {
	const statement = getStatement(
		'insertBookmark',
		`INSERT INTO bookmarks
		(id, title, url, created_at, device_id)
		VALUES
		($id, $title, $url, $created_at, $device_id)`,
	);

	return statement.run({
		...bookmark,
		id: uuid(),
		created_at: dateDefault(bookmark.created_at),
	});
}

export function getBookmarks(parameters: Parameters = {}) {
	const statement = getStatement<Bookmark>(
		'getBookmarks',
		`SELECT * FROM bookmarks
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY created_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters));
}

export function countBookmarks() {
	const statement = getStatement<{ total: number }>('countBookmarks', 'SELECT COUNT(*) as total FROM bookmarks');

	return statement.get()?.total ?? 0;
}

export function deleteBookmark(id: string) {
	const statement = getStatement('deleteBookmark', 'DELETE FROM bookmarks WHERE id = $id');

	return statement.run({ id });
}

export function updateBookmark({ id, title, url, created_at }: Update<Bookmark>) {
	const statement = getStatement(
		'updateBookmark',
		`UPDATE bookmarks
		SET title = $title,
		    url = $url,
		    created_at = $created_at
		WHERE id = $id`,
	);

	return statement.run({ id, title, url, created_at: dateDefault(created_at) });
}
