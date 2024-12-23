import type { HTTPError } from '@tombofry/stdlib/types/errors/http.js';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import appCreate from './lib/appCreate.js';
import { config } from './lib/config.js';
import Logger from './lib/logger.js';
import { validatePageNumber } from './lib/middleware/validatePageNumber.js';

// Routers
import bookmarks from './routers/external/bookmarks.js';
import device from './routers/external/device.js';
import frontend from './routers/external/frontend.js';
import health from './routers/external/health.js';
import listenbrainz from './routers/external/listenbrainz.js';
import purchases from './routers/external/purchases.js';
import youtube from './routers/external/youtube.js';

const log = new Logger('server-ext');

const app = appCreate();
app.use(helmet(config.helmet));
app.use(validatePageNumber(false));

if (config.bluesky.username?.startsWith('did:plc:')) {
	app.get('/.well-known/atproto-did', (_, res) => {
		res.type('text/plain').send(config.bluesky.username);
		return;
	});
}

// Set up routers
app.use('/api/device', device);
app.use('/api/listenbrainz', listenbrainz);
app.use('/api/youtube', youtube);
app.use('/api/health', health);
app.use('/api/purchases', purchases);
app.use('/api/bookmarks', bookmarks);

app.use(express.static('public'));
app.use('/', frontend);

app.use((err: HTTPError, req: Request, res: Response, _next: NextFunction): void => {
	log.error(err.message, err.code, req.originalUrl);
	if (err.code !== 404) {
		log.error(err.stack);
	}

	res.status(err.code || 500).render('external/error', { error: err.message });
});

const startServer = () => {
	const port = config.portExternal;
	app.listen(port, () => {
		log.info(`Running on port ${port}`);
	});
};

export default startServer;
