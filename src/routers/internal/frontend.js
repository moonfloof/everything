import express from 'express';
import { NotFoundError } from '@tombofry/stdlib/src/errors/http.js';

const router = express.Router();

// DASHBOARD

router.get('/', (_req, res) => {
	res.render('internal/index');
});

// NOT FOUND

router.get('*', () => { throw new NotFoundError('Page Not Found'); });

export default router;
