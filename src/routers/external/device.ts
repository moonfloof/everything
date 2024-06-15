import express from 'express';
import { reverseLocation } from '../../adapters/geocoder.js';
import { updateDevice, validateDevice } from '../../database/devices.js';
import { insertLocation } from '../../database/locations.js';
import Logger from '../../lib/logger.js';
import type { RequestFrontend } from '../../types/express.js';

const log = new Logger('Overland');

const router = express.Router();

interface Location {
	properties: {
		timestamp: string;
		battery_state: string;
		battery_level: number;
	};
	geometry: {
		coordinates: [number, number];
	};
}

const updateBatteryState = (
	deviceId: string,
	battery: { battery_level: number; battery_state: boolean | string | null },
	level_exponent = 100,
) => {
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

const isLocationValid = (location: Location): boolean => {
	if (location.geometry.coordinates === undefined) {
		log.debug('Location not provided, skipping');
		return false;
	}

	if (location.geometry.coordinates.length !== 2) {
		log.debug('Two coordinates not provided, skipping');
		return false;
	}

	if (!location.properties.timestamp) {
		log.debug('Timestamp not provided, skipping');
		return false;
	}

	return true;
};

// Overland API
// - https://github.com/aaronpk/Overland-iOS#api
// - https://overland.p3k.app/
router.post('/overland', async (req: RequestFrontend, res) => {
	try {
		// Validate Device ID / API Key
		const { apiKey } = req.query;
		const { id: device_id } = validateDevice(apiKey);

		if (!Array.isArray(req.body.locations)) {
			throw new Error('Please send an array of locations');
		}

		if (req.body.locations.length === 0) {
			throw new Error('Please send at least one location');
		}

		const locations: Location[] = req.body.locations;

		log.debug(`Received ${locations.length} locations to process`);

		// Sort by timestamp ascending
		locations.sort((a, b) => {
			const dateA = new Date(a.properties.timestamp).getTime();
			const dateB = new Date(b.properties.timestamp).getTime();
			return dateA - dateB;
		});

		// Add locations to database
		let index = 0;
		const lastLocation = locations[locations.length - 1];

		// Get city information for last entry
		let lastCity = null;
		const results = await reverseLocation(
			lastLocation.geometry.coordinates[1],
			lastLocation.geometry.coordinates[0],
		);
		lastCity = results?.city || null;
		if (typeof lastCity === 'string' && results?.state) {
			lastCity += `, ${results.state}`;
		}

		for (const location of locations) {
			index += 1;

			if (!isLocationValid(location)) continue;

			const created_at = new Date(location.properties.timestamp).getTime();
			const [long, lat] = location.geometry.coordinates ?? [];

			// Get city from last location in batch
			const city = index === locations.length ? lastCity : null;
			insertLocation({ lat, long, city, created_at, device_id });
		}

		// Get latest battery level
		const { battery_state, battery_level } = lastLocation.properties;

		if (!(battery_level || battery_state)) {
			res.send({ result: 'ok' });
			return;
		}

		updateBatteryState(device_id, { battery_level, battery_state }, 10000);

		res.send({ result: 'ok' });
	} catch (err) {
		log.error(err);
		res.status(400).send({ result: 'err', message: (err as Error).message });
	}
});

// Battery Level and Status
router.post('/battery', (req: RequestFrontend<object, { battery_level: number; battery_state: string }>, res) => {
	try {
		const token = req.headers.authorization;
		if (!token) {
			throw new Error('Please provide an authorization token');
		}

		const { id } = validateDevice(token);
		updateBatteryState(id, req.body, 100);

		res.send({ status: 'ok' });
	} catch (err) {
		log.error(err);
		res.status(400).send({ status: 'err', message: (err as Error).message });
	}
});

export default router;
