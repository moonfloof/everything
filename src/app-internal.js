import express from 'express';
import Logger from './lib/logger.js';
import appCreate from './lib/appCreate.js';

// Routers
import purchases from './routers/internal/purchases.js';
import games from './routers/internal/games.js';
import timetracking from './routers/internal/timetracking.js';
import sleep from './routers/internal/sleep.js';
import listens from './routers/internal/listens.js';
import youtubelikes from './routers/internal/youtubelikes.js';
import weight from './routers/internal/weight.js';
import frontend from './routers/internal/frontend.js';

const log = new Logger('server-int');

const app = appCreate();

// Set up routers
app.use(express.static('public'));
app.use('/purchases', purchases);
app.use('/games', games);
app.use('/timetracking', timetracking);
app.use('/sleep', sleep);
app.use('/listens', listens);
app.use('/youtubelikes', youtubelikes);
app.use('/weight', weight);
app.use('/', frontend);

const startServer = () => {
	const port = process.env.TOMBOIS_SERVER_PORT_INTERNAL;
	app.listen(port, () => {
		log.info(`Running on port ${port}`);
	});
};

export default startServer;
