import express from 'express';
import Logger from './lib/logger.js';
import appCreate from './lib/appCreate.js';

// Routers
import purchases from './routers/internal/purchases.js';
import games from './routers/internal/games.js';
import frontend from './routers/internal/frontend.js';

const log = new Logger('server-int');

const app = appCreate();

// Set up routers
app.use(express.static('public'));
app.use('/purchases', purchases);
app.use('/games', games);
app.use('/', frontend);

const startServer = () => {
	const port = process.env.TOMBOIS_SERVER_PORT_INTERNAL;
	app.listen(port, () => {
		log.info(`Running on port ${port}`);
	});
};

export default startServer;
