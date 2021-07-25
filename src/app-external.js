import path from 'path';
import express from 'express';
import helmet from 'helmet';
import exphbs from 'express-handlebars';
import { rawBody, logEntry } from '@tombofry/stdlib/src/express/index.js';
import Logger from './lib/logger.js';

// Routers
import overland from './routers/overland.js';
import listenbrainz from './routers/listenbrainz.js';
import youtube from './routers/youtube.js';
import health from './routers/health.js';
import purchases from './routers/purchases.js';
import frontend from './routers/frontend.js';

const log = new Logger('http');

// Set up API
const app = express();
app.use(helmet());
app.use(rawBody);
app.use((req, _res, next) => {
	try {
		req.body = JSON.parse(req.rawBody);
	} catch (err) { /* Do nothing */ }

	next();
});
app.use(logEntry(console.info));

// Set up routers
app.use('/api/overland', overland);
app.use('/api/listenbrainz', listenbrainz);
app.use('/api/youtube', youtube);
app.use('/api/health', health);
app.use('/api/purchases', purchases);

// Set up frontend
app.engine('.hbs', exphbs({ extname: '.hbs' }));
app.set('views', path.resolve('src/views'));
app.set('view engine', '.hbs');

app.use(express.static('public'));
app.use('/', frontend);

const startServer = () => {
	const port = process.env.TOMBOIS_SERVER_PORT;
	app.listen(port, () => {
		log.info(`App running on port ${port}`);
	});
};

export default startServer;
