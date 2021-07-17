import express from 'express';
import { validateDevice } from '../database/devices.js';
import { insertLocation } from '../database/locations.js';
import Logger from '../lib/logger.js';

const log = new Logger('Overland');

const router = express.Router();

router.post('/', async (req, res) => {
	try {
		// Validate Device ID / API Key
		const { apiKey } = req.query;
		const { id: deviceId } = await validateDevice(apiKey);

		if (!Array.isArray(req.body.locations)) {
			throw new Error('Please send an array of locations');
		}

		if (req.body.locations.length === 0) {
			throw new Error('Please send at least one location');
		}

		const { locations } = req.body;

		log.debug(`Received ${locations.length} locations to process`);

		// Add locations to database
		const promises = locations.reduce((acc, location) => {
			if (location?.geometry?.coordinates === undefined) {
				log.debug('Location not provided, skipping');
				return acc;
			}
			if (location?.geometry?.coordinates.length !== 2) {
				log.debug('Two coordinates not provided, skipping');
				return acc;
			}

			const { timestamp } = location.properties;
			const timestampDate = new Date(timestamp);
			const timestampISO = timestampDate.toISOString();

			const [ lon, lat ] = location?.geometry?.coordinates;
			acc.push({ lat, lon, timestampISO });
			return acc;
		}, []);

		await Promise.all(promises.map(loc => (
			insertLocation(loc.lat, loc.lon, null, loc.timestampISO, deviceId)
		)));

		res.send({ result: 'ok' });
	} catch (err) {
		// eslint-disable-next-line no-console
		console.log(err);
		res.send({ result: 'err', message: err.message });
	}
});

export default router;
