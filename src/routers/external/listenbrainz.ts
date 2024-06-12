import express from 'express';
import { validateDevice } from '../../database/devices.js';
import { insertScrobble } from '../../database/listens.js';
import { minuteMs } from '../../lib/formatDate.js';
import Logger from '../../lib/logger.js';
import type { RequestFrontend } from '../../types/express.js';
import { searchTrack } from '../../adapters/subsonic.js';

const log = new Logger('ListenBrainz');
const router = express.Router();

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

router.get('/1/validate-token', (req: RequestFrontend, res) => {
	try {
		const { token } = req.query;

		const { description } = validateDevice(token);

		res.send({
			code: 200,
			message: 'Token valid.',
			valid: true,
			user: description,
		});
	} catch (err) {
		res.send({
			code: 200,
			message: 'Token invalid.',
			valid: false,
		});
	}
});

interface ListenBrainzPayload {
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

router.post('/1/submit-listens', async (req: RequestFrontend<object, ListenBrainzPayload>, res) => {
	try {
		// Validate Device API Key
		const authToken = req.header('Authorization')?.toLowerCase();
		if (!authToken || authToken.startsWith('token ') === false) {
			throw new Error('Provided token is invalid');
		}
		const { id: device_id } = validateDevice(authToken.substring(6));

		// Set now playing notification
		if (req.body.listen_type === 'playing_now') {
			const { artist_name: artist, track_name: title } = req.body.payload[0].track_metadata;

			log.debug(`Setting "${title}" by ${artist} as now playing`);

			nowPlaying.artist = artist;
			nowPlaying.title = title;
			nowPlaying.updated_at = Date.now();
			res.send({ status: 'ok' });
			return;
		}

		for (const scrobble of req.body.payload) {
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

			// Get extra data from subsonic, if available
			// The API unfortunately doesn't return genre data nicely.
			if (release_year === null || tracknumber === null) {
				const search = await searchTrack(title, album, artist);

				if (search?.track) tracknumber = search.track;
				if (search?.year) release_year = search.year;
			}

			log.debug(`Saving "${title}" by ${artist}`);

			insertScrobble({
				artist,
				album,
				title,
				tracknumber,
				release_year,
				genre,
				created_at,
				device_id,
			});
		}

		res.send({ status: 'ok' });
	} catch (err) {
		const error = err as Error;
		log.error(err);
		res.status(500).send({
			status: 'error',
			code: 500,
			error: error.message,
		});
	}
});

export default router;
