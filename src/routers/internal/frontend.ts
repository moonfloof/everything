import express from 'express';
import { addNewDevice, getDeviceCount } from '../../database/devices.js';
import type { RequestFrontend } from '../../types/express.js';

const router = express.Router();

// DASHBOARD

router.get('/', (_req, res) => {
	if (getDeviceCount() === 0) {
		res.redirect('/setup');
		return;
	}
	res.render('internal/index');
});

// SETUP

router.get('/setup', (_req, res) => {
	if (getDeviceCount() > 0) {
		res.redirect('/');
		return;
	}
	res.render('internal/setup-required');
});

router.post('/setup', (req: RequestFrontend<object, { description: string; apiKey: string }>, res) => {
	try {
		const { description, apiKey } = req.body;

		if (getDeviceCount() > 0) {
			throw new Error('A device already exists. Please use that');
		}

		if (!(description && apiKey)) {
			throw new Error('Please provide BOTH a description and API key');
		}

		const { id: device_id } = addNewDevice(description, apiKey);
		res.render('internal/setup-required', { device_id });
	} catch (err) {
		res.render('internal/setup-required', { error: (err as Error).message });
	}
});

export default router;
