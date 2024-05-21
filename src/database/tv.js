import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import timeago from '../adapters/timeago.js';
import { calculateGetParameters } from './constants.js';

/**
 * @export
 * @param {string} series_title
 * @param {string} episode_title
 * @param {string} created_at
 * @param {string} device_id
 * @return {import('better-sqlite3').RunResult}
 */
export function insertEpisode (series_title, episode_title, created_at, device_id) {
	const id = uuid();

	const statement = getStatement(
		'insertEpisode',
		`INSERT INTO tv
		(id, series_title, episode_title, created_at, device_id)
		VALUES
		($id, $series_title, $episode_title, $created_at, $device_id)`,
	);

	return statement.run({
		id,
		series_title,
		episode_title,
		created_at,
		device_id,
	});
}

/**
 * Fetch all watched episodes, or based on a specific ID
 *
 * @export
 * @param {object} parameters
 * @param {string} [parameters.id]
 * @param {number} [parameters.page]
 * @param {number} [parameters.limit]
 * @param {number} [parameters.days]
 */
export function getEpisodes (parameters) {
	const statement = getStatement(
		'getEpisodes',
		`SELECT * FROM tv
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY created_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement
		.all(calculateGetParameters(parameters))
		.map(row => ({
			...row,
			timeago: timeago.format(new Date(row.created_at)),
		}));
}

/**
 * @param {string} id
 * @return {import('better-sqlite3').RunResult}
 */
export function deleteEpisode (id) {
	const statement = getStatement(
		'deleteEpisode',
		'DELETE FROM tv WHERE id = $id',
	);
	return statement.run({ id });
}

/**
 * @param {string} id
 * @param {string} series_title
 * @param {string} episode_title
 * @param {string} created_at
 * @return {import('better-sqlite3').RunResult}
 */
export function updateEpisode (id, series_title, episode_title, created_at) {
	const statement = getStatement(
		'updateEpisode',
		`UPDATE tv
		SET series_title = $series_title,
		    episode_title = $episode_title,
		    created_at = $created_at
		WHERE id = $id`,
	);

	return statement.run({
		id,
		series_title,
		episode_title,
		created_at,
	});
}

/** @return {number} */
export function countEpisodes () {
	const statement = getStatement(
		'countEpisodes',
		'SELECT COUNT(*) as total FROM tv',
	);

	return statement.get().total;
}
