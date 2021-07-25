import express from 'express';
import helmet from 'helmet';
import Logger from './lib/logger.js';
import appCreate from './lib/appCreate.js';

// Routers
import overland from './routers/external/overland.js';
import listenbrainz from './routers/external/listenbrainz.js';
import youtube from './routers/external/youtube.js';
import health from './routers/external/health.js';
import purchases from './routers/external/purchases.js';
import frontend from './routers/external/frontend.js';

const log = new Logger('server-ext');

const app = appCreate();
app.use(helmet);

// Set up routers
app.use('/api/overland', overland);
app.use('/api/listenbrainz', listenbrainz);
app.use('/api/youtube', youtube);
app.use('/api/health', health);
app.use('/api/purchases', purchases);

app.use(express.static('public'));
app.use('/', frontend);

const startServer = () => {
	const port = process.env.TOMBOIS_SERVER_PORT_EXTERNAL;
	app.listen(port, () => {
		log.info(`Running on port ${port}`);
	});
};

export default startServer;
