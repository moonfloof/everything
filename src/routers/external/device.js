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

/**
 * @param {string} deviceId
 * @param {{battery_level: number, battery_state: boolean|string}} battery
 * @param {number} level_exponent
 */
const updateBatteryState = (deviceId, battery, level_exponent = 100) => {
	let status = battery.battery_state;

	switch (status) {
		case true: {
			status = 'charging';
			break;
		}
		case false: {
			status = 'unplugged';
			break;
		}
		case 'unknown': {
			status = null;
			break;
		}
		default:
			break;
	}

	if (typeof status !== 'string') {
		status = null;
	}

	// Round battery charge to 2 decimal places
	const level = Math.round(battery.battery_level * level_exponent) / 100 || 100;

	updateDevice(deviceId, level, status);
};

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
		let index = 0;
		const lastLocation = locations[locations.length - 1];

		// Get city information for last entry
		const results = await getGeocoder().reverse({
			lat: lastLocation.geometry.coordinates[1],
			lon: lastLocation.geometry.coordinates[0],
		});
		let city = results?.[0]?.city;
		if (results?.[0]?.state && typeof city === 'string') {
			city += `, ${results[0].state}`;
		}

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

			const timestamp = new Date(location.properties.timestamp).toISOString();
			const [lon, lat] = location?.geometry?.coordinates ?? [];

			// Get city from last location in batch
			const currentCity = index === locations.length ? city : null;
			insertLocation(lat, lon, currentCity, timestamp, deviceId);
		}

		// Get latest battery level
		const { battery_state, battery_level } = lastLocation.properties;

		if (!(battery_level || battery_state)) {
			res.send({ result: 'ok' });
			return;
		}

		updateBatteryState(deviceId, lastLocation.properties, 10000);

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

		updateBatteryState(id, req.body, 100);

		res.send({ status: 'ok' });
	} catch (err) {
		log.error(err);
		res.status(400).send({ status: 'err', message: err.message });
	}
});

export default router;
