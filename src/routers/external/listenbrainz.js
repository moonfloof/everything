import express from 'express';
import { validateDevice } from '../../database/devices.js';
import { insertScrobble } from '../../database/listens.js';
import Logger from '../../lib/logger.js';

const log = new Logger('ListenBrainz');

const router = express.Router();

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
		const { id: deviceId } = validateDevice(authToken.substr(6));

		// Ignore "now playing" requests
		if (req.body.listen_type === 'playing_now') {
			res.send({ status: 'ok' });
			return;
		}

		req.body.payload.forEach(scrobble => {
			// Get payload data
			const timestamp = new Date(scrobble.listened_at * 1000).toISOString();
			const {
				artist_name: artist,
				track_name: title,
				release_name: album,
			} = scrobble.track_metadata;

			// Apparently additional_info doesn't always get sent
			const releaseDateISO = scrobble.track_metadata?.additional_info?.date;
			const genres = scrobble.track_metadata?.additional_info?.tags;
			const tracknumber = scrobble.track_metadata?.additional_info?.tracknumber;

			// Process payload data
			const year = releaseDateISO && new Date(releaseDateISO).getFullYear();
			const genre = Array.isArray(genres) && genres.length > 0
				? genres[0]
				: null;

			log.debug(`Saving "${title}" by ${artist}`);

			insertScrobble(
				artist,
				album,
				title,
				tracknumber,
				year,
				genre,
				timestamp,
				deviceId,
			);
		});

		res.send({ status: 'ok' });
	} catch (err) {
		console.error(err);
		res.status(500).send({
			status: 'error',
			code: 500,
			error: err.message,
		});
	}
});

export default router;
