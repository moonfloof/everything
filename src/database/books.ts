import type { RunResult } from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import { timeago } from '../adapters/timeago.js';
import { dateDefault, formatDate, prettyDate } from '../lib/formatDate.js';
import type { Insert, Optional } from '../types/database.js';
import { type Parameters, calculateGetParameters } from './constants.js';
import { getStatement } from './database.js';

interface Book {
	id: string;
	title: string;
	author: string;
	year: number;
	genre: Optional<string>;
	pages_total: Optional<number>;
	pages_progress: Optional<number>;
	rating: Optional<number>;
	url: Optional<string>;
	created_at: string;
	updated_at: string;
	started_at: string;
	completed_at: Optional<string>;
	device_id: string;
}

export function insertBook(book: Insert<Book>): RunResult {
	const statement = getStatement(
		'insertBook',
		`INSERT INTO books
		(id, title, author, genre, year, pages_total, pages_progress, rating, url, started_at, completed_at, created_at, updated_at, device_id)
		VALUES
		($id, $title, $author, $genre, $year, $pages_total, $pages_progress, $rating, $url, $started_at, $completed_at, $created_at, $updated_at, $device_id)`,
	);

	return statement.run({
		...book,
		id: uuid(),
		started_at: dateDefault(book.started_at),
		created_at: dateDefault(book.created_at),
		completed_at: book.completed_at ? new Date(book.completed_at).toISOString() : null,
		updated_at: new Date().toISOString(),
	});
}

export function getBooks(parameters: Partial<Parameters> = {}) {
	const statement = getStatement<Book>(
		'getBooks',
		`SELECT * FROM books
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY updated_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters)).map(row => {
		let progress = null;
		let status = 'to-read';

		if (row.pages_total !== null && row.pages_progress !== null) {
			const finished = row.pages_total === row.pages_progress;
			const percent = Math.round((row.pages_progress / row.pages_total) * 100);

			progress = `read ${percent}% <small>(${row.pages_progress || 0} / ${
				row.pages_total
			} pages)</small>`;
			status = 'reading';

			if (finished) {
				progress = `completed on ${prettyDate(new Date(row.completed_at || Date.now()))}`;
				status = 'finished';
			}
		}

		return {
			...row,
			progress,
			status,
			timeago: timeago.format(new Date(row.updated_at || row.created_at)),
		};
	});
}

export function deleteBook(id: string) {
	const statement = getStatement('deleteBook', 'DELETE FROM books WHERE id = $id');
	return statement.run({ id });
}

export function countBooks(): number {
	const statement = getStatement<{ total: number }>('countBooks', 'SELECT COUNT(*) as total FROM books');
	return statement.get()?.total || 0;
}

export function updateBook(book: Partial<Book>) {
	const statement = getStatement(
		'updateBook',
		`UPDATE books
		SET title = $title,
		    author = $author,
		    genre = $genre,
		    year = $year,
		    pages_total = $pages_total,
		    pages_progress = $pages_progress,
		    rating = $rating,
		    url = $url,
		    created_at = $created_at,
		    updated_at = $updated_at,
		    started_at = $started_at,
		    completed_at = $completed_at
		WHERE id = $id`,
	);

	// Auto-complete book if pages match
	const completed_calculated = book.completed_at
		? book.completed_at
		: book.pages_progress === book.pages_total
			? formatDate(new Date())
			: null;

	return statement.run({
		...book,
		completed_at: completed_calculated,
		started_at: dateDefault(book.started_at),
		created_at: dateDefault(book.created_at),
		updated_at: new Date().toISOString(),
	});
}
