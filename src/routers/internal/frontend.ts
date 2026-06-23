import express from 'express';
import { setConfigValue } from '../../database/config.js';
import { addNewDevice, getDeviceCount } from '../../database/devices.js';
import { config } from '../../lib/config/index.js';
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

router.post('/setup', (req: RequestFrontend<object, { description: string; apiKey: string; name: string }>, res) => {
	try {
		const { description, apiKey, name } = req.body;

		if (getDeviceCount() > 0) {
			throw new Error('A device already exists. Please use that');
		}

		if (!(description && apiKey && name)) {
			throw new Error('Please provide all values - a name, description, and API key.');
		}

		const { id: device_id } = addNewDevice(description, apiKey);

		// TODO: Setting config values with this function should also set the
		// config object.
		setConfigValue('default_device_id', device_id);
		setConfigValue('person_name', name);
		setConfigValue('version_string', `everything (${name})`);
		config.defaultDeviceId = device_id;
		config.personName = name;
		config.versionString = `everything (${name})`;

		res.redirect('/');
	} catch (err) {
		res.render('internal/setup-required', { error: (err as Error).message });
	}
});

export default router;
