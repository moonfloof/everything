import express from 'express';
import { getGeocoder } from '../../adapters/geocoder.js';
import { updateDevice, validateDevice } from '../../database/devices.js';
import { insertLocation } from '../../database/locations.js';
import Logger from '../../lib/logger.js';

const log = new Logger('Overland');

const router = express.Router();

/**
 * @typedef {object} Location
 * @prop {object} properties
 * @prop {number} properties.timestamp
 * @prop {object} geometry
 * @prop {[number, number]} geometry.coordinates
 */

// Overland
router.post('/overland', async (req, res) => {
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

		/** @type {Location[]} */
		const locations = req.body.locations;

		log.debug(`Received ${locations.length} locations to process`);

		// Sort by timestamp ascending
		locations.sort((a, b) => {
			const dateA = new Date(a.properties.timestamp);
			const dateB = new Date(b.properties.timestamp);
			return dateA - dateB;
		});

		// Add locations to database
		let index = -1;
		for (const location of locations) {
			index += 1;

			if (location?.geometry?.coordinates === undefined) {
				log.debug('Location not provided, skipping');
				continue;
			}

			if (location?.geometry?.coordinates.length !== 2) {
				log.debug('Two coordinates not provided, skipping');
				continue;
			}

			const { timestamp } = location.properties;
			const timestampDate = new Date(timestamp);
			const timestampISO = timestampDate.toISOString();

			const [lon, lat] = location?.geometry?.coordinates ?? [];

			// Get city from last location in batch
			let city = null;
			if (index === locations.length - 1) {
				const results = await getGeocoder().reverse({ lat, lon });
				city = results?.[0]?.city;
				if (results?.[0]?.state && typeof city === 'string') {
					city += `, ${results?.[0]?.state}`;
				}
			}

			insertLocation(lat, lon, city, timestampISO, deviceId);
		}

		// Get latest battery level
		const lastLoc = locations[locations.length - 1];
		let { battery_state, battery_level } = lastLoc.properties;

		if (!battery_level && !battery_state) {
			res.send({ result: 'ok' });
			return;
		}

		// Round to two decimal places
		battery_level = Math.round(battery_level * 10000) / 100 || 100;

		switch (battery_state) {
			case true:
				battery_state = 'charging';
				break;
			case false:
				battery_state = 'unplugged';
				break;
			case 'unknown':
				battery_state = null;
				break;
			default:
				break;
		}

		updateDevice(deviceId, battery_level, battery_state);

		res.send({ result: 'ok' });
	} catch (err) {
		log.error(err);
		res.status(400).send({ result: 'err', message: err.message });
	}
});

// Battery Level and Status
router.post('/battery', (req, res) => {
	try {
		const token = req.headers.authorization;
		const { id } = validateDevice(token);
		let { battery_level, battery_state } = req.body;

		// Round to two decimal places
		battery_level = Math.round(battery_level * 100) / 100 || 100;

		switch (battery_state) {
			case true:
				battery_state = 'charging';
				break;
			case false:
				battery_state = 'unplugged';
				break;
			case 'unknown':
				battery_state = null;
				break;
			default:
				break;
		}

		if (typeof battery_state !== 'string') {
			battery_state = null;
		}

		updateDevice(id, battery_level, battery_state);

		res.send({ status: 'ok' });
	} catch (err) {
		log.error(err);
		res.status(400).send({ status: 'err', message: err.message });
	}
});

export default router;
