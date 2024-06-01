import express from 'express';
import { NotFoundError } from '@tombofry/stdlib/src/errors/http.js';
import appCreate from './lib/appCreate.js';
import Logger from './lib/logger.js';
import { trimStrings } from './lib/middleware/trimStrings.js';
import { validatePageNumber } from './lib/middleware/validatePageNumber.js';

// Routers
import bookmarks from './routers/internal/bookmarks.js';
import books from './routers/internal/books.js';
import films from './routers/internal/films.js';
import food from './routers/internal/food.js';
import frontend from './routers/internal/frontend.js';
import games from './routers/internal/games.js';
import listens from './routers/internal/listens.js';
import location from './routers/internal/location.js';
import notes from './routers/internal/notes.js';
import purchases from './routers/internal/purchases.js';
import scrobble from './routers/internal/scrobble.js';
import steps from './routers/internal/steps.js';
import timetracking from './routers/internal/timetracking.js';
import tv from './routers/internal/tv.js';
import weight from './routers/internal/weight.js';
import youtubelikes from './routers/internal/youtubelikes.js';

const log = new Logger('server-int');

const app = appCreate();

app.use(express.static('public'));
app.use(trimStrings);
app.use(validatePageNumber(true));

// Set up routers
app.use('/', frontend);
app.use('/bookmarks', bookmarks);
app.use('/books', books);
app.use('/films', films);
app.use('/food', food);
app.use('/games', games);
app.use('/listens', listens);
app.use('/location', location);
app.use('/notes', notes);
app.use('/purchases', purchases);
app.use('/scrobble', scrobble);
app.use('/steps', steps);
app.use('/timetracking', timetracking);
app.use('/tv', tv);
app.use('/weight', weight);
app.use('/youtubelikes', youtubelikes);

app.get('*', () => {
	throw new NotFoundError('Page Not Found');
});

app.use((err, req, res, _next) => {
	log.error(err.message, err.code, req.originalUrl);
	if (err.code !== 404) {
		log.error(err.stack);
	}

	res.status(err.code || 500).render('internal/error', { error: err });
});

const startServer = () => {
	const port = process.env.TOMBOIS_SERVER_PORT_INTERNAL;
	app.listen(port, () => {
		log.info(`Running on port ${port}`);
	});
};

export default startServer;
