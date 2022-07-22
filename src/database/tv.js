import { v4 as uuid } from 'uuid';
import { getStatement } from './database.js';
import timeago from '../adapters/timeago.js';
import { calculateOffset, RECORDS_PER_PAGE } from './constants.js';

/**
 * @export
 * @param {string} series_title
 * @param {string} episode_title
 * @param {Date}   created_at
 * @param {string} device_id
 * @return {Promise<any>}
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
 * @param {string} [id]
 * @param {number} [page]
 */
export function getEpisodes (id, page) {
	const statement = getStatement(
		'getEpisodes',
		`SELECT * FROM tv
		WHERE id LIKE $id
		ORDER BY created_at DESC
		LIMIT ${RECORDS_PER_PAGE} OFFSET $offset`,
	);

	return statement
		.all({
			id: id || '%',
			offset: calculateOffset(page),
		})
		.map(row => ({
			...row,
			timeago: timeago.format(new Date(row.created_at)),
		}));
}

export function deleteEpisode (id) {
	const statement = getStatement(
		'deleteEpisode',
		'DELETE FROM tv WHERE id = $id',
	);
	return statement.run({ id });
}

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

export function countEpisodes () {
	const statement = getStatement(
		'countEpisodes',
		'SELECT COUNT(*) as total FROM tv',
	);

	return statement.get().total;
}
