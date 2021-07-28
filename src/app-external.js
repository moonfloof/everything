import express from 'express';
import helmet from 'helmet';
import Logger from './lib/logger.js';
import appCreate from './lib/appCreate.js';

// Routers
import device from './routers/external/device.js';
import listenbrainz from './routers/external/listenbrainz.js';
import youtube from './routers/external/youtube.js';
import health from './routers/external/health.js';
import purchases from './routers/external/purchases.js';
import bookmarks from './routers/external/bookmarks.js';
import frontend from './routers/external/frontend.js';

const log = new Logger('server-ext');

const app = appCreate();
app.use(helmet());

// Set up routers
app.use('/api/device', device);
app.use('/api/listenbrainz', listenbrainz);
app.use('/api/youtube', youtube);
app.use('/api/health', health);
app.use('/api/purchases', purchases);
app.use('/api/bookmarks', bookmarks);

app.use(express.static('public'));
app.use('/', frontend);

const startServer = () => {
	const port = process.env.TOMBOIS_SERVER_PORT_EXTERNAL;
	app.listen(port, () => {
		log.info(`Running on port ${port}`);
	});
};

export default startServer;
