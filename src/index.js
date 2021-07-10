import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';

// Routers
import overland from './routers/overland.js';
import listenbrainz from './routers/listenbrainz.js';
import frontend from './routers/frontend.js';

// Load .env file
dotenv.config();

// Set up API
const app = express();
app.use(helmet());
app.use(express.json());

// Set up routers
app.use('/api/overland', overland);
app.use('/api/listenbrainz', listenbrainz);
app.use('/', frontend);

// Start server
const port = process.env.TOMBOIS_SERVER_PORT;
app.listen(port, () => {
	// eslint-disable-next-line no-console
	console.log(`App running on port ${port}`);
});
