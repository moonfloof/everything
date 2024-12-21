import { v4 as uuid } from 'uuid';
import { timeago } from '../adapters/timeago.js';
import { dateDefault, dayMs, hourMs, shortDate } from '../lib/formatDate.js';
import type { Insert, Optional, Select, Update } from '../types/database.js';
import { type Parameters, calculateGetParameters } from './constants.js';
import { getStatement } from './database.js';

export interface ListenTrack {
	id: number;
	album: string;
	artist: string;
	title: string;
	track_number: Optional<number>;
	release_year: Optional<number>;
	genre: Optional<string>;
	duration_secs: Optional<number>;
}

export type ListenInsert = Insert<ListenTrack> & {
	created_at: string;
	device_id: string;
};

export type Listen = Omit<ListenTrack, 'id'> & {
	id: string;
	track_id: number;
	created_at: string;
	device_id: string;
};

interface ListenGroup {
	artist: string;
	album: string;
	created_at: string;
	ended_at: string;
	timeago: string;
	tracks: { title: string; id: string }[];
	count: number;
	countText: 'song' | 'songs';
}

function selectListenTrack(track: Insert<ListenTrack>): number | undefined {
	const selectResult = getStatement<{ id: number }>(
		'selectListenTrack',
		`SELECT id FROM listens_track
		WHERE artist = $artist AND album = $album AND title = $title
		LIMIT 1`,
	).get({
		artist: track.artist,
		album: track.album,
		title: track.title,
	});

	return selectResult?.id;
}

function selectListenTrackFromListenId(listen: { id: string }) {
	return getStatement<{ id: number }>(
		'selectListenTrackFromListenId',
		`SELECT t.id as id FROM listens AS l
		JOIN listens_track AS t ON l.track_id = t.id
		WHERE l.id == $id
		LIMIT 1;`,
	).get({ id: listen.id })?.id;
}

function selectOrInsertTrack(track: Insert<ListenTrack>): number {
	const id = selectListenTrack(track);

	if (id !== undefined) return id;

	getStatement(
		'insertListenTrack',
		`INSERT INTO listens_track
		(artist, album, title, track_number, release_year, genre, duration_secs)
		VALUES
		($artist, $album, $title, $track_number, $release_year, $genre, $duration_secs)`,
	).run(track);

	// biome-ignore lint/style/noNonNullAssertion: Track guaranteed to exist at this point
	return selectListenTrack(track)!;
}

export function insertScrobble(listen: ListenInsert) {
	const track_id = selectOrInsertTrack(listen);
	updateListenTrack({ ...listen, track_id, id: '' });
	const statement = getStatement(
		'insertListen',
		`INSERT INTO listens
		(id, track_id, created_at, device_id)
		VALUES
		($id, $track_id, $created_at, $device_id)`,
	);

	return statement.run({
		id: uuid(),
		track_id,
		created_at: dateDefault(listen.created_at),
		device_id: listen.device_id,
	});
}

export function getListens(parameters: Partial<Parameters> = {}) {
	const statement = getStatement<Listen>(
		'getListens',
		`SELECT l.*, t.artist, t.album, t.title, t.track_number, t.release_year, t.genre, t.duration_secs
		FROM listens AS l
		JOIN listens_track AS t ON l.track_id = t.id
		WHERE l.id LIKE $id AND l.created_at >= $created_at
		ORDER BY l.created_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters)).map(row => ({
		...row,
		timeago: timeago.format(new Date(row.created_at)),
	}));
}

export function groupListens(listens: Select<Listen>[]) {
	return listens.reduce((albums, listen) => {
		if (
			albums.length === 0 ||
			// Different album/artist
			albums[albums.length - 1].album !== listen.album ||
			albums[albums.length - 1].artist !== listen.artist ||
			// Same album/artist, but longer than one hour since last listen
			Math.abs(
				new Date(albums[albums.length - 1].created_at).getTime() -
					new Date(listen.created_at).getTime(),
			) > hourMs
		) {
			albums.push({
				artist: listen.artist,
				album: listen.album,
				created_at: listen.created_at,
				ended_at: listen.created_at,
				timeago: listen.timeago,
				tracks: [{ title: listen.title, id: listen.id }],
				count: 1,
				countText: 'song',
			});
			return albums;
		}

		albums[albums.length - 1].tracks.push({ title: listen.title, id: listen.id });
		albums[albums.length - 1].count += 1;
		albums[albums.length - 1].countText = 'songs';
		albums[albums.length - 1].created_at = listen.created_at;
		return albums;
	}, [] as ListenGroup[]);
}

export function deleteListen(id: string) {
	const statement = getStatement('deleteListen', 'DELETE FROM listens WHERE id = $id');
	return statement.run({ id });
}

export function updateListenTrack(track: Update<Listen> & { track_id?: number }) {
	const track_id = track.track_id ?? (track.id ? selectListenTrackFromListenId(track) : selectListenTrack(track));
	if (!track_id) {
		throw new Error('Expected to find a track');
	}

	getStatement(
		'updateListenTrack',
		`UPDATE listens_track
		SET artist = $artist,
		    album = $album,
		    title = $title,
		    track_number = $track_number,
		    release_year = $release_year,
		    genre = $genre,
		    duration_secs = $duration_secs
		WHERE id = $id`,
	).run({ ...track, id: track_id });

	return track_id;
}

export function updateListen(listen: Update<Listen>) {
	const track_id = updateListenTrack(listen);
	const statement = getStatement(
		'updateListen',
		`UPDATE listens
		SET track_id = $track_id,
		    created_at = $created_at
		WHERE id = $id`,
	);

	return statement.run({
		track_id,
		created_at: dateDefault(listen.created_at),
		id: listen.id,
	});
}

export function countListens() {
	const statement = getStatement<{ total: number }>('countListens', 'SELECT COUNT(*) as total FROM listens');

	return statement.get()?.total || 0;
}

export function getListensPopular(days: number) {
	const statement = getStatement<{ artist: string; count: number }>(
		'getListensPopular',
		`SELECT t.artist AS artist, count(*) as count
		FROM listens AS l
		JOIN listens_track AS t ON t.id = l.track_id
		WHERE created_at >= $created_at
		GROUP BY artist
		ORDER BY count DESC, artist ASC
		LIMIT 10`,
	);

	const created_at = new Date(Date.now() - days * dayMs).toISOString();
	const rows = statement.all({ created_at });

	return rows.map(row => ({
		...row,
		popularityPercentage: (row.count / rows[0].count) * 100,
	}));
}

export function getListenPopularDashboard(days: number) {
	const generateStatement = (column: keyof Listen) =>
		getStatement<{ title: string; count: number }>(
			`getListenPopularDashboard_${column}`,
			`SELECT t.${column} as label, count(*) as count FROM listens AS l
			JOIN listens_track AS t ON t.id = l.track_id
			WHERE created_at >= $created_at
			GROUP BY label
			ORDER BY count DESC
			LIMIT 1;`,
		);

	const created_at = new Date(Date.now() - days * dayMs).toISOString();

	const artist = generateStatement('artist').get({ created_at });
	const album = generateStatement('album').get({ created_at });
	const song = generateStatement('title').get({ created_at });

	if (!(artist?.count && album?.count && song?.count)) return null;

	return {
		artist,
		album,
		song,
	};
}

export function getListenGraph() {
	const statement = getStatement<{ day: string; y: number }>(
		'getListenGraph',
		`SELECT DATE(created_at) as day, COUNT(*) as y
		FROM listens
		GROUP BY day
		ORDER BY day DESC
		LIMIT 14;`,
	);

	return statement.all().map(row => ({
		...row,
		day: new Date(row.day),
		label: shortDate(new Date(row.day)),
	}));
}

export function getListenDashboardGraph() {
	const statement = getStatement<{ day: string; max: number }>(
		'getListenDashboardGraph',
		`SELECT DATE(created_at) as day, COUNT(*) as max
		FROM listens
		GROUP BY day
		ORDER BY day DESC
		LIMIT 14;`,
	);

	return statement.all().map(row => ({
		day: new Date(row.day),
		min: 0,
		max: row.max,
	}));
}

export function getPopularAlbumWithArtist(days = 14) {
	const statement = getStatement<{ album: string; artist: string; count: number }>(
		'getPopularAlbumWithArtist',
		`SELECT t.artist as artist, t.album as album, COUNT(*) AS count FROM listens_track AS t
		JOIN listens AS l ON l.track_id = t.id
		WHERE created_at >= $created_at
		GROUP BY album, artist
		ORDER BY count DESC
		LIMIT 1;`,
	);

	const created_at = new Date(Date.now() - days * dayMs).toISOString();

	return statement.get({ created_at });
}

export function getTracksWithMissingMetadata() {
	return getStatement<ListenTrack>(
		'getTracksWithMissingMetadata',
		`SELECT * FROM listens_track
		WHERE
		    genre == '' OR genre LIKE 'Unknown%' OR genre IS NULL OR
		    release_year IS NULL OR
		    track_number IS NULL OR
		    duration_secs IS NULL;`,
	).all();
}
