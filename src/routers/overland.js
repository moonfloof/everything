import express from 'express';
import { validateDevice } from '../database/devices.js';
import { insertLocation } from '../database/locations.js';
import Logger from '../lib/logger.js';

const log = new Logger('Overland');

const router = express.Router();

router.post('/', (req, res) => {
	try {
		// Validate Device ID / API Key
		const { apiKey } = req.query;
		const { id: deviceId } = validateDevice(apiKey);

		if (!Array.isArray(req.body.locations)) {
			throw new Error('Please send an array of locations');
		}

		if (req.body.locations.length === 0) {
			throw new Error('Please send at least one location');
		}

		const { locations } = req.body;

		log.debug(`Received ${locations.length} locations to process`);

		// Add locations to database
		locations.forEach(location => {
			if (location?.geometry?.coordinates === undefined) {
				log.debug('Location not provided, skipping');
				return;
			}

			if (location?.geometry?.coordinates.length !== 2) {
				log.debug('Two coordinates not provided, skipping');
				return;
			}

			const { timestamp } = location.properties;
			const timestampDate = new Date(timestamp);
			const timestampISO = timestampDate.toISOString();

			const [ lon, lat ] = location?.geometry?.coordinates;
			insertLocation(lat, lon, null, timestampISO, deviceId);
		});

		res.send({ result: 'ok' });
	} catch (err) {
		log.error(err);
		res.status(400).send({ result: 'err', message: err.message });
	}
});

export default router;
