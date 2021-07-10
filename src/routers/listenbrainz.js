import express from 'express';
import { validateDevice } from '../database/devices.js';
import { insertScrobble } from '../database/listens.js';

const router = express.Router();

router.get('/validate-token', async (req, res) => {
	try {
		const { token } = req.query;

		const { description } = await validateDevice(token);

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

router.post('/submit-listens', async (req, res) => {
	try {
		// Validate Device API Key
		const authToken = req.header('Authorization');
		if (authToken.startsWith('Token ') === false) {
			throw new Error('Provided token is invalid');
		}
		const { id: deviceId } = await validateDevice(authToken.substr(6));

		// Ignore "now playing" requests
		if (req.body.listen_type === 'playing_now') {
			res.send({ status: 'ok' });
			return;
		}

		const promises = req.body.payload.map(async scrobble => {
			// Get payload data
			const timestamp = new Date(scrobble.listened_at * 1000).toISOString();
			const {
				artist_name: artist,
				track_name: title,
				release_name: album,
			} = scrobble.track_metadata;
			const {
				date: releaseDateISO,
				tags: genres,
				tracknumber,
			} = scrobble.track_metadata.additional_info;

			// Process payload data
			const year = new Date(releaseDateISO).getFullYear();
			const genre = Array.isArray(genres) && genres.length > 0
				? genres[0]
				: null;

			await insertScrobble(
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

		await Promise.all(promises);

		res.send({ status: 'ok' });
	} catch (err) {
		res.status(500).send({
			status: 'error',
			code: 500,
			error: err.message,
		});
	}
});

export default router;
