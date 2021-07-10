import express from 'express';

const router = express.Router();

router.use(
	express.static('public'),
	(_req, res) => res.status(400).send('<h1>404 Not Found</h1>'),
);

export default router;
