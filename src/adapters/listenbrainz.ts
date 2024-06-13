import type { Listen } from '../database/listens.js';
import { minuteMs } from '../lib/formatDate.js';
import Logger from '../lib/logger.js';
import { searchTrack } from './subsonic.js';

const log = new Logger('ListenBrainz');

export interface ListenBrainzPayload {
	listen_type: 'playing_now' | 'single' | 'import';
	payload: {
		listened_at: number;
		track_metadata: {
			artist_name: string;
			track_name: string;
			release_name: string;
			additional_info?: {
				date: string;
				tags: string[];
				tracknumber: number;
			};
		};
	}[];
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

export function setNowPlaying(payload: ListenBrainzPayload['payload']) {
	const { artist_name: artist, track_name: title } = payload[0].track_metadata;

	log.debug(`Setting "${title}" by ${artist} as now playing`);

	nowPlaying.artist = artist;
	nowPlaying.title = title;
	nowPlaying.updated_at = Date.now();
}

export async function convertScrobbleIntoListen(
	scrobble: ListenBrainzPayload['payload'][0],
): Promise<Omit<Listen, 'id' | 'device_id'>> {
	// Get payload data
	const created_at = new Date(scrobble.listened_at * 1000).toISOString();
	const { artist_name: artist, track_name: title, release_name: album } = scrobble.track_metadata;

	// Apparently additional_info doesn't always get sent
	const releaseDateISO = scrobble.track_metadata.additional_info?.date;
	const genres = scrobble.track_metadata.additional_info?.tags;
	let tracknumber = scrobble.track_metadata.additional_info?.tracknumber || null;

	// Process payload data
	let release_year = releaseDateISO ? new Date(releaseDateISO).getFullYear() : null;
	const genre = Array.isArray(genres) && genres.length > 0 ? genres[0] : null;

	if (release_year === null || tracknumber === null) {
		// Get extra data from subsonic, if available
		// The API unfortunately doesn't return genre data nicely.
		const search = await searchTrack(title, album, artist);

		if (!tracknumber && search?.track) tracknumber = search.track;
		if (!release_year && search?.year) release_year = search.year;
	}

	return {
		artist,
		album,
		title,
		tracknumber,
		release_year,
		genre,
		created_at,
	};
}
