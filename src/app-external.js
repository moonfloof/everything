import express from 'express';
import helmet from 'helmet';
import appCreate from './lib/appCreate.js';
import Logger from './lib/logger.js';
import { validatePageNumber } from './lib/middleware/validatePageNumber.js';

import bookmarks from './routers/external/bookmarks.js';
// Routers
import device from './routers/external/device.js';
import frontend from './routers/external/frontend.js';
import health from './routers/external/health.js';
import listenbrainz from './routers/external/listenbrainz.js';
import purchases from './routers/external/purchases.js';
import youtube from './routers/external/youtube.js';

const log = new Logger('server-ext');

const app = appCreate();
app.use(helmet());
app.use(validatePageNumber(false));

// Set up routers
app.use('/api/device', device);
app.use('/api/listenbrainz', listenbrainz);
app.use('/api/youtube', youtube);
app.use('/api/health', health);
app.use('/api/purchases', purchases);
app.use('/api/bookmarks', bookmarks);

app.use(express.static('public'));
app.use('/', frontend);

app.use((err, req, res, _next) => {
	log.error(err.message, err.code, req.originalUrl);
	if (err.code !== 404) {
		log.error(err.stack);
	}

	res.status(err.code || 500).render('external/error', { error: err.message });
});

const startServer = () => {
	const port = process.env.TOMBOIS_SERVER_PORT_EXTERNAL;
	app.listen(port, () => {
		log.info(`Running on port ${port}`);
	});
};

export default startServer;
