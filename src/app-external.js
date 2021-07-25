import express from 'express';
import Logger from './lib/logger.js';

// Routers
import overland from './routers/overland.js';
import listenbrainz from './routers/listenbrainz.js';
import youtube from './routers/youtube.js';
import health from './routers/health.js';
import purchases from './routers/purchases.js';
import frontend from './routers/frontend.js';
import appCreate from './lib/appCreate.js';

const log = new Logger('http');

const app = appCreate();

// Set up routers
app.use('/api/overland', overland);
app.use('/api/listenbrainz', listenbrainz);
app.use('/api/youtube', youtube);
app.use('/api/health', health);
app.use('/api/purchases', purchases);

app.use(express.static('public'));
app.use('/', frontend);

const startServer = () => {
	const port = process.env.TOMBOIS_SERVER_PORT;
	app.listen(port, () => {
		log.info(`App running on port ${port}`);
	});
};

export default startServer;
