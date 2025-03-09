import { errors } from '@moonfloof/stdlib';
const { BadRequestError } = errors;
import { Router } from 'express';
import { generateAuthenticateUri, swarmHandleOauthCallback, swarmHandlePushCheckin } from '../../adapters/swarm.js';
import type { RequestFrontend } from '../../types/express.js';
import { validateDevice } from '../../database/devices.js';
import Logger from '../../lib/logger.js';

const log = new Logger('swarm-api');
const router = Router();

router.get('/login', (_req, res) => {
	res.redirect(generateAuthenticateUri());
});

router.get('/callback', async (req: RequestFrontend, res) => {
	const { code } = req.query;

	if (code === undefined) {
		throw new BadRequestError('Code was not provided - cannot log in.');
	}

	await swarmHandleOauthCallback(code);

	res.redirect('/');
});

router.post('/push', (req: RequestFrontend, res) => {
	try {
		const { apiKey } = req.query;
		const device = validateDevice(apiKey);

		const { checkin, secret } = req.body;

		if (checkin === undefined || secret === undefined) {
			throw new BadRequestError('Swarm - Missing checkin and secret from payload');
		}

		swarmHandlePushCheckin(JSON.parse(checkin), secret, device.id);

		res.send({ status: 'ok' });
	} catch (err) {
		log.error(err);
		res.status(400).send({ status: (err as Error).message });
	}
});

export default router;
