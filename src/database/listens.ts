import { v4 as uuid } from 'uuid';
import { timeago } from '../adapters/timeago.js';
import addMissingDates from '../lib/addMissingDates.js';
import { dateDefault, dayMs, formatDate, hourMs, monthsShort, shortDate } from '../lib/formatDate.js';
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
	let svg = `<svg class="a-graph" viewBox="0 0 ${width} ${height}" version="1.1" xmlns="http://www.w3.org/2000/svg">`;
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
