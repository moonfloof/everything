import express from 'express';
import { validateDevice } from '../database/devices.js';
import { insertLocation } from '../database/locations.js';

const router = express.Router();

router.post('/', async (req, res) => {
	try {
		if (!Array.isArray(req.body.locations)) {
			throw new Error('Please send an array of locations');
		}

		if (req.body.locations.length === 0) {
			throw new Error('Please send at least one location');
		}

		const { locations } = req.body;

		// Validate Device ID / API Key
		const apiKey = locations[0].properties.device_id;
		const { id: deviceId } = await validateDevice(apiKey);

		const promises = locations.map(async location => {
			const { timestamp } = location.properties;

			const [ lon, lat ] = location?.geometry?.coordinates;
			await insertLocation(lat, lon, null, timestamp, deviceId);
		});

		await Promise.all(promises);

		res.send({ result: 'ok' });
	} catch (err) {
		// eslint-disable-next-line no-console
		console.log(err);
		res.send({ result: 'err', message: err.message });
	}
});

export default router;
