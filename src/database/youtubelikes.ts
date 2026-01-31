import { v4 as uuid } from 'uuid';
import { timeago } from '../adapters/timeago.js';
import { dateDefault, dayMs, prettyDuration } from '../lib/formatDate.js';
import type { Insert, Optional, Update } from '../types/database.js';
import { calculateGetParameters, type Parameters } from './constants.js';
import { getStatement } from './database.js';

interface YouTubeLike {
	id: string;
	video_id: string;
	title: string;
	channel: Optional<string>;
	duration_secs: Optional<number>;
	device_id: string;
	created_at: string;
}

export function insertYouTubeLike(video: Insert<YouTubeLike>) {
	const statement = getStatement(
		'insertYouTubeLike',
		`INSERT INTO youtubelikes
		(id, video_id, title, channel, duration_secs, device_id, created_at)
		VALUES
		($id, $video_id, $title, $channel, $duration_secs, $device_id, $created_at)`,
	);

	return statement.run({
		...video,
		id: uuid(),
		created_at: dateDefault(video.created_at),
	});
}

export function getLikes(parameters: Parameters = {}) {
	const statement = getStatement<YouTubeLike>(
		'getYouTubeLikes',
		`SELECT * FROM youtubelikes
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY created_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters)).map(row => ({
		...row,
		url: `https://www.youtube.com/watch?v=${row.video_id}`,
		timeago: timeago.format(new Date(row.created_at)),
	}));
}

export function countYouTubeLikes() {
	const statement = getStatement<{ total: number }>(
		'countYouTubeLikes',
		'SELECT COUNT(*) as total FROM youtubelikes',
	);

	return statement.get()?.total || 0;
}

export function deleteYouTubeLike(id: string) {
	const statement = getStatement('deleteYouTubeLike', 'DELETE FROM youtubelikes WHERE id = $id');
	return statement.run({ id });
}

export function updateYouTubeLike(video: Update<YouTubeLike>) {
	const statement = getStatement(
		'updateYouTubeLike',
		`UPDATE youtubelikes
		SET video_id = $video_id,
		    title = $title,
		    channel = $channel,
		    duration_secs = $duration_secs,
		    created_at = $created_at
		WHERE id = $id`,
	);

	return statement.run({
		...video,
		created_at: dateDefault(video.created_at),
	});
}

export function getPopularYouTubeChannels(days: number, limit = 10) {
	const statement = getStatement<{ channel: string; count: number }>(
		'getPopularYouTubeChannels',
		`SELECT channel, sum(duration_secs) as count
		FROM youtubelikes
		WHERE created_at >= $created_at
		GROUP BY channel
		ORDER BY count DESC, channel ASC
		LIMIT $limit`,
	);

	const created_at = new Date(Date.now() - days * dayMs).toISOString();
	const rows = statement.all({ created_at, limit });

	return rows.map(row => ({
		...row,
		durationPretty: prettyDuration(row.count * 1000),
		popularityPercentage: (row.count / rows[0].count) * 100,
	}));
}
