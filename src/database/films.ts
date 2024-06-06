import { v4 as uuid } from 'uuid';
import { timeago } from '../adapters/timeago.js';
import { dateDefault } from '../lib/formatDate.js';
import type { Optional } from '../types/database.js';
import { type Parameters, calculateGetParameters } from './constants.js';
import { getStatement } from './database.js';

interface Film {
	id: string;
	title: string;
	year: number;
	rating: Optional<number>;
	review: Optional<string>;
	url: Optional<string>;
	watched_at: string;
	created_at: string;
	device_id: string;
}

export function insertFilm(film: Omit<Film, 'id'>) {
	const statement = getStatement(
		'insertFilm',
		`INSERT INTO films
		(id, title, year, rating, review, url, watched_at, created_at, device_id)
		VALUES
		($id, $title, $year, $rating, $review, $url, $watched_at, $created_at, $device_id)`,
	);

	return statement.run({
		...film,
		id: uuid(),
		watched_at: dateDefault(film.watched_at),
		created_at: dateDefault(film.created_at),
	});
}

export function getFilms(parameters: Partial<Parameters> = {}) {
	const statement = getStatement<Film>(
		'getFilms',
		`SELECT * FROM films
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY created_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters)).map(row => ({
		...row,
		timeago: timeago.format(new Date(row.watched_at)),
	}));
}

export function deleteFilm(id: string) {
	const statement = getStatement('deleteFilm', 'DELETE FROM films WHERE id = $id');
	return statement.run({ id });
}

export function updateFilm(film: Omit<Film, 'device_id'>) {
	const statement = getStatement(
		'updateFilm',
		`UPDATE films
		SET title = $title,
		    year = $year,
		    rating = $rating,
		    review = $review,
		    url = $url,
		    watched_at = $watched_at,
		    created_at = $created_at
		WHERE id = $id`,
	);

	return statement.run({
		...film,
		watched_at: dateDefault(film.watched_at),
		created_at: dateDefault(film.created_at),
	});
}

export function countFilms() {
	const statement = getStatement<{ total: number }>('countFilms', 'SELECT COUNT(*) as total FROM films');
	return statement.get()?.total || 0;
}
