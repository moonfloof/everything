import path from 'path';
import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import exphbs from 'express-handlebars';
import rawBody from '@tombofry/stdlib/src/express/rawBody.js';
import logEntry from './lib/httpLog.js';
import Logger from './lib/logger.js';
import { getDatabase } from './database/database.js';

// Adapters
import { pollForLikedVideos } from './adapters/youtube.js';
import { pollForGameActivity } from './adapters/steam.js';

// Routers
import overland from './routers/overland.js';
import listenbrainz from './routers/listenbrainz.js';
import youtube from './routers/youtube.js';
import frontend from './routers/frontend.js';

const log = new Logger('http');

// Load .env file
dotenv.config();

// Set up API
const app = express();
app.use(helmet());
app.use(express.json());
app.use(rawBody);
app.use(logEntry);

// Set up routers
app.use('/api/overland', overland);
app.use('/api/listenbrainz', listenbrainz);
app.use('/api/youtube', youtube);

// Set up frontend
app.engine('.hbs', exphbs({ extname: '.hbs' }));
app.set('views', path.resolve('src/views'));
app.set('view engine', '.hbs');

app.use(express.static('public'));
app.use('/', frontend);

// Set up polling adapters
pollForLikedVideos();
pollForGameActivity();

// Start server
const port = process.env.TOMBOIS_SERVER_PORT;
app.listen(port, () => {
	log.info(`App running on port ${port}`);
});

process.on('exit', async () => {
	log.info('Exiting - closing database');

	getDatabase().close();
});
