import express from 'express';
import { validateDevice } from '../../database/devices.js';
import { insertScrobble } from '../../database/listens.js';
import { minuteMs } from '../../lib/formatDate.js';
import Logger from '../../lib/logger.js';

const log = new Logger('ListenBrainz');
const router = express.Router();

const nowPlaying = {
	artist: null,
	title: null,
	updated_at: new Date(),
};

export function getNowPlaying() {
	// Skip if there are missing details
	if (!nowPlaying.artist || !nowPlaying.title) {
		return null;
	}

	// Now Playing notifications last 10 minutes from the time they are submitted
	const timeout = new Date(Date.now() - 10 * minuteMs);

	// Last update was more than 10 minutes ago
	if (nowPlaying.updated_at - timeout < 0) {
		return null;
	}

	return nowPlaying;
}

router.get('/1/validate-token', (req, res) => {
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

router.post('/1/submit-listens', (req, res) => {
	try {
		// Validate Device API Key
		const authToken = req.header('Authorization')?.toLowerCase();
		if (authToken.startsWith('token ') === false) {
			throw new Error('Provided token is invalid');
		}
		const { id: deviceId } = validateDevice(authToken.substring(6));

		// Set now playing notification
		if (req.body.listen_type === 'playing_now') {
			const { artist_name: artist, track_name: title } = req.body.payload[0].track_metadata;

			log.debug(`Setting "${title}" by ${artist} as now playing`);

			nowPlaying.artist = artist;
			nowPlaying.title = title;
			nowPlaying.updated_at = new Date();
			res.send({ status: 'ok' });
			return;
		}

		for (const scrobble of req.body.payload) {
			// Get payload data
			const timestamp = new Date(scrobble.listened_at * 1000).toISOString();
			const { artist_name: artist, track_name: title, release_name: album } = scrobble.track_metadata;

			// Apparently additional_info doesn't always get sent
			const releaseDateISO = scrobble.track_metadata?.additional_info?.date;
			const genres = scrobble.track_metadata?.additional_info?.tags;
			const tracknumber = scrobble.track_metadata?.additional_info?.tracknumber;

			// Process payload data
			const year = releaseDateISO && new Date(releaseDateISO).getFullYear();
			const genre = Array.isArray(genres) && genres.length > 0 ? genres[0] : null;

			log.debug(`Saving "${title}" by ${artist}`);

			insertScrobble(artist, album, title, tracknumber, year, genre, timestamp, deviceId);
		}

		res.send({ status: 'ok' });
	} catch (err) {
		log.error(err);
		res.status(500).send({
			status: 'error',
			code: 500,
			error: err.message,
		});
	}
});

export default router;
