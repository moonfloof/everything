import express from 'express';
import { getDevices } from '../database/devices.js';

const router = express.Router();

router.get('/', async (_req, res) => {
	try {
		const results = await getDevices();
		res.send({ results });
	} catch (err) {
		res.status(400).send({
			status: 'error',
			error: err.message,
		});
	}
});

export default router;
