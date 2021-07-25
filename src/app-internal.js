import express from 'express';
import Logger from './lib/logger.js';
import appCreate from './lib/appCreate.js';

// Routers
import frontend from './routers/internal/frontend.js';

const log = new Logger('server-int');

const app = appCreate();

// Set up routers
app.use(express.static('public'));
app.use('/', frontend);

const startServer = () => {
	const port = process.env.TOMBOIS_SERVER_PORT_INTERNAL;
	app.listen(port, () => {
		log.info(`Running on port ${port}`);
	});
};

export default startServer;
