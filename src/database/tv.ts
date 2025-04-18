import { v4 as uuid } from 'uuid';
import { timeago } from '../adapters/timeago.js';
import { dateDefault, msToIsoDuration, prettyDuration } from '../lib/formatDate.js';
import type { Insert, Optional, Update } from '../types/database.js';
import { type Parameters, calculateGetParameters } from './constants.js';
import { getStatement } from './database.js';

interface Episode {
	id: string;
	series_title: string;
	episode_title: string;
	duration_secs: Optional<number>;
	created_at: string;
	device_id: string;
}

export function insertEpisode(episode: Insert<Episode>) {
	const statement = getStatement(
		'insertEpisode',
		`INSERT INTO tv (id, series_title, episode_title, duration_secs, created_at, device_id)
		VALUES ($id, $series_title, $episode_title, $duration_secs, $created_at, $device_id)`,
	);

	return statement.run({
		...episode,
		id: uuid(),
		created_at: dateDefault(episode.created_at),
	});
}

export function getEpisodes(parameters: Parameters = {}) {
	const statement = getStatement<Episode>(
		'getEpisodes',
		`SELECT * FROM tv
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY created_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters)).map(row => ({
		...row,
		durationIso: row.duration_secs ? msToIsoDuration(row.duration_secs * 1000) : null,
		durationPretty: row.duration_secs ? prettyDuration(row.duration_secs * 1000) : null,
		timeago: timeago.format(new Date(row.created_at)),
	}));
}

export function deleteEpisode(id: string) {
	const statement = getStatement('deleteEpisode', 'DELETE FROM tv WHERE id = $id');
	return statement.run({ id });
}

export function countEpisodes() {
	const statement = getStatement<{ total: number }>('countEpisodes', 'SELECT COUNT(*) as total FROM tv');
	return statement.get()?.total || 0;
}

export function updateEpisode(episode: Update<Episode>) {
	const statement = getStatement(
		'updateEpisode',
		`UPDATE tv
		SET series_title = $series_title,
		    episode_title = $episode_title,
		    duration_secs = $duration_secs,
		    created_at = $created_at
		WHERE id = $id`,
	);

	return statement.run({
		...episode,
		created_at: dateDefault(episode.created_at),
	});
}
