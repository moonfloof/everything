import type { ListenInsert } from '../database/listens.js';
import { minuteMs } from '../lib/formatDate.js';
import Logger from '../lib/logger.js';
import { searchTrack } from './subsonic.js';

const log = new Logger('ListenBrainz');

type NewListen = Omit<ListenInsert, 'id' | 'device_id'>;

interface ListenBrainzTrack {
	listened_at: number;
	track_metadata: {
		artist_name: string;
		track_name: string;
		release_name: string;
		additional_info?: {
			date?: string;
			tags?: string[];
			tracknumber?: number;
			duration_ms?: number;
		};
	};
}

export interface ListenBrainzPayload {
	listen_type: 'playing_now' | 'single' | 'import';
	payload: ListenBrainzTrack[];
}

const nowPlaying: { artist: string | null; title: string | null; updated_at: number } = {
	artist: null,
	title: null,
	updated_at: Date.now(),
};

export function getNowPlaying() {
	// Skip if there are missing details
	if (!(nowPlaying.artist && nowPlaying.title)) {
		return null;
	}

	// Now Playing notifications last 10 minutes from the time they are submitted
	const timeout = new Date(Date.now() - 10 * minuteMs).getTime();

	// Last update was more than 10 minutes ago
	if (nowPlaying.updated_at - timeout < 0) {
		return null;
	}

	return nowPlaying;
}

export function setNowPlaying(track: ListenBrainzTrack) {
	const { artist_name: artist, track_name: title } = track.track_metadata;

	log.debug(`Setting "${title}" by ${artist} as now playing`);

	nowPlaying.artist = artist;
	nowPlaying.title = title;
	nowPlaying.updated_at = Date.now();
}

async function fillMissingData(listen: NewListen): Promise<NewListen> {
	if (
		listen.release_year !== null &&
		listen.track_number !== null &&
		listen.duration_secs !== null &&
		listen.genre !== null
	) {
		return listen;
	}

	// Get extra data from subsonic, if available
	const search = await searchTrack(listen.title, listen.album, listen.artist);

	if (!listen.track_number && search?.track) listen.track_number = search.track;
	if (!listen.release_year && search?.year) listen.release_year = search.year;
	if (!listen.duration_secs && search?.duration) listen.duration_secs = search.duration;
	if (!listen.genre && search?.genre) listen.genre = search.genre;

	return listen;
}

export async function convertScrobbleIntoListen(scrobble: ListenBrainzPayload['payload'][0]): Promise<NewListen> {
	// Get payload data
	const created_at = new Date(scrobble.listened_at * 1000).toISOString();
	const { artist_name: artist, track_name: title, release_name: album } = scrobble.track_metadata;

	// Additional_info doesn't always get sent
	const { date, tags, tracknumber, duration_ms } = scrobble.track_metadata.additional_info ?? {};

	let listen = {
		artist,
		title,
		album,
		created_at,

		track_number: tracknumber || null,
		duration_secs: duration_ms !== undefined ? duration_ms / 1000 : null,
		release_year: date ? new Date(date).getFullYear() : null,
		genre: Array.isArray(tags) && tags[0] !== undefined ? tags[0] : null,
	};

	listen = await fillMissingData(listen);

	return listen;
}
