import { errors } from '@moonfloof/stdlib';
const { BadRequestError } = errors;
import { Router } from 'express';
import { generateAuthenticateUri, swarmHandleOauthCallback, swarmHandlePushCheckin } from '../../adapters/swarm.js';
import type { RequestFrontend } from '../../types/express.js';

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

router.post('/push', (req, res) => {
	const { checkin, secret } = req.body;

	if (checkin === undefined || secret === undefined) {
		throw new BadRequestError('Swarm - Missing checkin and secret from payload');
	}

	swarmHandlePushCheckin(JSON.parse(checkin), secret);

	res.send({ status: 'ok' });
});

export default router;
