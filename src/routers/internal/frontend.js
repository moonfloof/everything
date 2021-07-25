import express from 'express';
import { NotFoundError } from '@tombofry/stdlib/src/errors/http.js';

import Logger from '../../lib/logger.js';
const log = new Logger('frontend');

const router = express.Router();

// DASHBOARD

router.get('/', (_req, res) => {
	res.render('internal/index');
});

// NOT FOUND

router.get('*', () => { throw new NotFoundError('Page Not Found'); });

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, _next) => {
	log.error(err.message, err.code, req.originalUrl);
	if (err.code !== 404) {
		log.error(err.stack);
	}

	res
		.status(err.code || 500)
		.render('internal/error', { error: err });
});

export default router;
