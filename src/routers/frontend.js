import express from 'express';
import path from 'path';

const router = express.Router();

router.use('/', express.static('public'));

router.use('*', (_req, res) => {
	const file = path.resolve('./public/index.html');
	res.sendFile(file);
});

export default router;
