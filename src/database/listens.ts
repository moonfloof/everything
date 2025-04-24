import { timeago } from '../adapters/timeago.js';
import addMissingDates from '../lib/addMissingDates.js';
import { dateDefault, dayMs, formatDate, hourMs, monthsShort, prettyDuration, shortDate } from '../lib/formatDate.js';
import type { Insert, Optional, Select } from '../types/database.js';
import { type Parameters, calculateGetParameters } from './constants.js';
import { getStatement } from './database.js';

//#region Types

export interface ListenArtist {
	id: string;
	artist: string;
}

export interface ListenAlbum {
	id: string;
	album: string;
	release_year: Optional<number>;
	genre: Optional<string>;
	artist_id: number;
}

export interface ListenTrack {
	id: string;
	title: string;
	track_number: Optional<number>;
	duration_secs: Optional<number>;
	album_id: number;
}

export interface ListenRaw {
	id: string;
	track_id: string;
	created_at: string;
}

export interface Listen {
	id: string;
	created_at: string;
	title: string;
	album: string;
	artist: string;
	track_number: Optional<number>;
	release_year: Optional<number>;
	duration_secs: Optional<number>;
	genre: Optional<string>;
}

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

//#endregion Types

//#region Inserting New Music

export function upsertArtist({ artist }: Pick<Listen, 'artist'>): ListenArtist {
	const newArtist = getStatement<ListenArtist>(
		'upsertArtist',
		`INSERT INTO listens_artist (artist) VALUES ($artist)
		ON CONFLICT (artist) DO UPDATE SET artist = excluded.artist
		RETURNING *;`,
	).get({ artist });

	if (!newArtist) {
		throw new Error('Artist failed to insert/update');
	}

	return newArtist;
}

export function upsertAlbum(
	{ album, release_year, genre }: Pick<Listen, 'album' | 'release_year' | 'genre'>,
	artist_id: string,
): ListenAlbum {
	const newAlbum = getStatement<ListenAlbum>(
		'upsertAlbum',
		`INSERT INTO listens_album
		(album, release_year, genre, artist_id)
		VALUES
		($album, $release_year, $genre, $artist_id)
		ON CONFLICT (album, artist_id)
		DO UPDATE SET
			album = excluded.album,
			release_year = excluded.release_year,
			genre = excluded.genre
		RETURNING *;`,
	).get({ artist_id, album, release_year, genre });

	if (!newAlbum) {
		throw new Error('Album failed to insert/update');
	}

	return newAlbum;
}

export function upsertTrack(
	{ title, track_number, duration_secs }: Pick<Listen, 'title' | 'track_number' | 'duration_secs'>,
	album_id: string,
): ListenTrack {
	const newTrack = getStatement<ListenTrack>(
		'upsertTrack',
		`INSERT INTO listens_track
		(title, track_number, duration_secs, album_id)
		VALUES
		($title, $track_number, $duration_secs, $album_id)
		ON CONFLICT (title, album_id)
		DO UPDATE SET
			title = excluded.title,
			track_number = excluded.track_number,
			duration_secs = excluded.duration_secs
		RETURNING *;`,
	).get({ title, track_number, duration_secs, album_id });

	if (!newTrack) {
		throw new Error('Track failed to insert/update');
	}

	return newTrack;
}

export function insertListenRaw({ created_at }: Pick<ListenRaw, 'created_at'>, track_id: string): ListenRaw {
	const newListen = getStatement<ListenRaw>(
		'insertListenRaw',
		`INSERT INTO listens
		(track_id, created_at)
		VALUES
		($track_id, $created_at)
		RETURNING *;`,
	).get({
		created_at: dateDefault(created_at),
		track_id,
	});

	if (!newListen) {
		throw new Error('Listen failed to insert/update');
	}

	return newListen;
}

export function insertScrobble(listen: Insert<Listen>) {
	// Step 1: Make sure artist exists
	const artist = upsertArtist(listen);

	// Step 2: Make sure album exists
	const album = upsertAlbum(listen, artist.id);

	// Step 3: Make sure track exists
	const track = upsertTrack(listen, album.id);

	// Step 4: Insert listen with track ID
	return insertListenRaw(listen, track.id);
}

//#endregion Inserting New Music

//#region Getting Existing Music

export function getListens(parameters: Parameters = {}) {
	const statement = getStatement<Listen>(
		'getListens',
		`SELECT l.id, created_at, title, album, artist, track_number, release_year, duration_secs, genre
		FROM listens AS l
		JOIN listens_track AS t ON t.id = l.track_id
		JOIN listens_album AS a ON a.id = t.album_id
		JOIN listens_artist AS r ON r.id = a.artist_id
		WHERE l.id LIKE $id AND created_at >= $created_at
		ORDER BY created_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters)).map(row => ({
		...row,
		timeago: timeago.format(new Date(row.created_at)),
	}));
}

export function getArtists(parameters: Parameters = {}) {
	const statement = getStatement<ListenArtist>(
		'getArtists',
		`SELECT * FROM listens_artist
		WHERE id LIKE $id
		ORDER BY artist ASC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters)).map(row => ({
		...row,
		albumCount: countAlbums(row.id),
	}));
}

export function getAlbums(parameters: Parameters = {}, artist_id?: string) {
	const statement = getStatement<ListenAlbum & { artist: string }>(
		'getAlbums',
		`SELECT a.*, r.artist FROM listens_album AS a
		JOIN listens_artist AS r ON r.id = a.artist_id
		WHERE a.id LIKE $id AND a.artist_id LIKE $artist_id
		ORDER BY a.release_year ASC, a.album ASC
		LIMIT $limit OFFSET $offset`,
	);

	return statement
		.all({
			...calculateGetParameters(parameters),
			artist_id: artist_id ?? '%',
		})
		.map(row => ({
			...row,
			trackCount: countTracks(row.id),
		}));
}

export function getTracks(parameters: Parameters = {}, album_id?: string) {
	const statement = getStatement<ListenAlbum & { album: string; artist: string }>(
		'getTracks',
		`SELECT t.*, a.album, r.artist FROM listens_track AS t
		JOIN listens_album AS a ON a.id = t.album_id
		JOIN listens_artist AS r ON r.id = a.artist_id
		WHERE t.id LIKE $id AND t.album_id LIKE $album_id
		ORDER BY t.track_number ASC, t.title ASC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all({
		...calculateGetParameters(parameters),
		album_id: album_id ?? '%',
	});
}

//#endregion Getting Existing Music

//#region Internal CRUD

export function updateListen(id: string, { track_id, created_at }: Pick<ListenRaw, 'track_id' | 'created_at'>) {
	return getStatement(
		'updateListenRaw',
		`UPDATE listens
		SET track_id = $track_id,
		    created_at = $created_at
		WHERE id = $id`,
	).run({ id, track_id, created_at });
}

export function deleteListen(id: string) {
	const statement = getStatement('deleteListen', 'DELETE FROM listens WHERE id = $id');
	return statement.run({ id });
}

export function updateArtist(id: string, { artist }: Pick<ListenArtist, 'artist'>) {
	const statement = getStatement('updateArtist', 'UPDATE listens_artist SET artist = $artist WHERE id = $id');
	return statement.run({ id, artist });
}

export function deleteArtist(id: string) {
	const statement = getStatement('deleteArtist', 'DELETE FROM listens_artist WHERE id = $id');
	return statement.run({ id });
}

export function updateAlbum(
	id: string,
	{ album, genre, release_year }: Pick<ListenAlbum, 'album' | 'genre' | 'release_year'>,
) {
	return getStatement(
		'updateAlbum',
		`UPDATE listens_album
		SET album = $album,
		    genre = $genre,
		    release_year = $release_year
		WHERE id = $id`,
	).run({ id, album, genre, release_year });
}

export function deleteAlbum(id: string) {
	const statement = getStatement('deleteAlbum', 'DELETE FROM listens_album WHERE id = $id');
	return statement.run({ id });
}

export function updateTrack(
	id: string,
	{ title, duration_secs, track_number }: Pick<ListenTrack, 'title' | 'duration_secs' | 'track_number'>,
) {
	return getStatement(
		'updateTrack',
		`UPDATE listens_track
		SET title = $title,
		    duration_secs = $duration_secs,
		    track_number = $track_number
		WHERE id = $id`,
	).run({ id, title, duration_secs, track_number });
}

export function deleteTrack(id: string) {
	const statement = getStatement('deleteTrack', 'DELETE FROM listens_track WHERE id = $id');
	return statement.run({ id });
}

//#endregion Internal CRUD

//#region Pagination

export function countArtists() {
	const statement = getStatement<{ total: number }>(
		'countArtists',
		'SELECT COUNT(*) as total FROM listens_artist',
	);
	return statement.get()?.total || 0;
}

export function countAlbums(artist_id = '%') {
	const statement = getStatement<{ total: number }>(
		'countAlbums',
		`SELECT COUNT(*) as total FROM listens_album
		WHERE artist_id LIKE $artist_id`,
	);
	return statement.get({ artist_id })?.total || 0;
}

export function countTracks(album_id = '%') {
	const statement = getStatement<{ total: number }>(
		'countTracks',
		`SELECT COUNT(*) as total FROM listens_track
		WHERE album_id LIKE $album_id`,
	);
	return statement.get({ album_id })?.total || 0;
}

export function countListens() {
	const statement = getStatement<{ total: number }>('countListens', 'SELECT COUNT(*) as total FROM listens');
	return statement.get()?.total || 0;
}

//#endregion Pagination

//#region Stats / Aggregation

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

export function getListensPopular(days: number) {
	const created_at = new Date(Date.now() - days * dayMs).toISOString();
	const rows = getListenPopularDashboardArtist(created_at, 10);

	if (rows[0] === undefined) {
		return [];
	}

	const usingDuration = rows[0].duration !== null;
	const getCount = ({ count, duration }: { count: number; duration: number | null }): number => {
		return usingDuration ? (duration ?? count) : count;
	};
	const popularCount = getCount(rows[0]);

	return rows.map(row => {
		const count = getCount(row);
		return {
			...row,
			duration: Math.round((count / hourMs) * 10) / 10,
			popularityPercentage: (count / popularCount) * 100,
		};
	});
}

function getListenPopularDashboardTrack(created_at: string) {
	return getStatement<{ title: string; duration: number | null; count: number }>(
		'getListenPopularDashboardTrack',
		`SELECT
			title AS label,
			COUNT(*) AS count,
			SUM(t.duration_secs)*1000 AS duration
		FROM listens AS l
		JOIN listens_track AS t ON t.id = l.track_id
		WHERE created_at >= $created_at
		GROUP BY label
		ORDER BY duration DESC, count DESC
		LIMIT 1;`,
	).all({ created_at });
}

function getListenPopularDashboardAlbum(created_at: string) {
	return getStatement<{ title: string; duration: number | null; count: number }>(
		'getListenPopularDashboardAlbum',
		`SELECT
			album AS label,
			COUNT(*) AS count,
			SUM(t.duration_secs)*1000 AS duration
		FROM listens AS l
		JOIN listens_track AS t ON t.id = l.track_id
		JOIN listens_album AS a ON a.id = t.album_id
		WHERE created_at >= $created_at
		GROUP BY label
		ORDER BY duration DESC, count DESC
		LIMIT 1;`,
	).all({ created_at });
}

function getListenPopularDashboardArtist(created_at: string, limit = 1) {
	return getStatement<{ title: string; duration: number | null; count: number }>(
		'getListenPopularDashboardArtist',
		`SELECT
			artist AS label,
			COUNT(*) AS count,
			SUM(t.duration_secs)*1000 AS duration
		FROM listens AS l
		JOIN listens_track AS t ON t.id = l.track_id
		JOIN listens_album AS a ON a.id = t.album_id
		JOIN listens_artist AS r ON r.id = a.artist_id
		WHERE created_at >= $created_at
		GROUP BY label
		ORDER BY duration DESC, count DESC
		LIMIT $limit;`,
	).all({ created_at, limit });
}

export function getListenPopularDashboard(days: number) {
	const created_at = new Date(Date.now() - days * dayMs).toISOString();

	const [artist] = getListenPopularDashboardArtist(created_at);
	const [album] = getListenPopularDashboardAlbum(created_at);
	const [track] = getListenPopularDashboardTrack(created_at);

	if (!(artist?.duration && album?.duration && track?.duration)) return null;

	return {
		artist: {
			...artist,
			duration: artist.duration ? prettyDuration(artist.duration) : null,
		},
		album: {
			...album,
			duration: album.duration ? prettyDuration(album.duration) : null,
		},
		track: {
			...track,
			duration: track.duration ? prettyDuration(track.duration) : null,
		},
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

// TODO: Fix!
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

const listenActivityGraphCache = {
	data: '',
	date: Date.now() - dayMs,
};

export function getListenActivityGraph() {
	if (listenActivityGraphCache.date > Date.now() - dayMs) {
		return listenActivityGraphCache.data;
	}

	const days = 365;
	const created_at = formatDate(new Date(Date.now() - dayMs * days));
	const listensOverTime = addMissingDates(
		getStatement<{ day: string; count: number }>(
			'getListenActivityGraph',
			`SELECT DATE(created_at) AS day, COUNT(id) AS count
			FROM listens
			WHERE created_at >= $created_at
			GROUP BY DATE(created_at)`,
		)
			.all({ created_at })
			.map(row => ({ day: new Date(row.day), count: row.count })),
		day => ({ day, count: 0 }),
		days + 1,
	);

	listensOverTime.reverse();
	const max = listensOverTime.reduce((max, day) => (day.count > max ? day.count : max), 0);

	// Create graph
	let col = 0;
	const colMax = Math.ceil(days / 7);
	const cellSize = 12;
	const padding = 2;
	const leftMargin = 48;
	const bottomMargin = 20;
	const width = leftMargin + (cellSize + padding) * colMax - padding;
	const height = (cellSize + padding) * 7 - padding + bottomMargin;
	let svg = `<svg viewBox="0 0 ${width} ${height}" version="1.1" xmlns="http://www.w3.org/2000/svg">`;
	svg += `\n<style>
		text { font-family: Inter, sans-serif; font-size: 12px; font-weight: 700; }
		rect { rx: 3px; ry: 3px; fill: #3e3475; }
	</style>`;
	for (const { day, count } of listensOverTime) {
		const dayOfWeek = day.getDay();
		if (count > 0) {
			const x = leftMargin + (cellSize + padding) * col;
			const y = (cellSize + padding) * dayOfWeek;
			const opacity = Math.round((count * 40) / max) / 40;
			const date = formatDate(day);
			svg += `\n<rect class="a-graph-cell" style="opacity: ${opacity}" x="${x}" y="${y}" width="${cellSize}" height="${cellSize}"><title>${date}: ${count}</title></rect>`;
		}
		if (dayOfWeek >= 6) col += 1;
	}
	svg += `\n<text class="a-graph-label" x="${leftMargin - 8}" y="${(cellSize + padding) * 2 - 4}" text-anchor="end">Mon</text>`;
	svg += `\n<text class="a-graph-label" x="${leftMargin - 8}" y="${(cellSize + padding) * 4 - 4}" text-anchor="end">Wed</text>`;
	svg += `\n<text class="a-graph-label" x="${leftMargin - 8}" y="${(cellSize + padding) * 6 - 4}" text-anchor="end">Fri</text>`;

	const labelEveryWeeks = 9;
	for (const index of Array.from({ length: Math.ceil(col / labelEveryWeeks) }).map((_, idx) => idx)) {
		const x = leftMargin + (cellSize + padding) * labelEveryWeeks * index;
		const day = listensOverTime[Math.ceil(index * labelEveryWeeks * 7)].day;
		const label = monthsShort[day.getMonth()];
		svg += `\n<text class="a-graph-label" x="${x}" y="${height - 4}">${label}</text>`;
	}
	svg += '\n</svg>';

	listenActivityGraphCache.data = svg;
	listenActivityGraphCache.date = Date.now();

	return svg;
}
//#endregion Stats / Aggregation
