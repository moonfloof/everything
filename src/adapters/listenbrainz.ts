import type { ListenInsert } from '../database/listens.js';
import { minuteMs } from '../lib/formatDate.js';
import Logger from '../lib/logger.js';
import { searchTrack } from './subsonic.js';

const log = new Logger('ListenBrainz');

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

export async function convertScrobbleIntoListen(
	scrobble: ListenBrainzPayload['payload'][0],
): Promise<Omit<ListenInsert, 'id' | 'device_id'>> {
	// Get payload data
	const created_at = new Date(scrobble.listened_at * 1000).toISOString();
	const { artist_name: artist, track_name: title, release_name: album } = scrobble.track_metadata;

	// Apparently additional_info doesn't always get sent
	const releaseDateISO = scrobble.track_metadata.additional_info?.date;
	const genres = scrobble.track_metadata.additional_info?.tags;
	let track_number = scrobble.track_metadata.additional_info?.tracknumber || null;
	let duration_secs = (scrobble.track_metadata.additional_info?.duration_ms ?? 0) / 1000 || null;

	// Process payload data
	let release_year = releaseDateISO ? new Date(releaseDateISO).getFullYear() : null;
	let genre = Array.isArray(genres) && genres[0] !== undefined ? genres[0] : null;

	if (release_year === null || track_number === null || duration_secs === null || genre === null) {
		// Get extra data from subsonic, if available
		// The API unfortunately doesn't return genre data nicely.
		const search = await searchTrack(title, album, artist);

		if (!track_number && search?.track) track_number = search.track;
		if (!release_year && search?.year) release_year = search.year;
		if (!duration_secs && search?.duration) duration_secs = search.duration;
		if (!genre && search?.genre) genre = search.genre;
	}

	return {
		artist,
		album,
		title,
		track_number,
		release_year,
		genre,
		duration_secs,
		created_at,
	};
}
