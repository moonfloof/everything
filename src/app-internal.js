import express from 'express';
import Logger from './lib/logger.js';
import appCreate from './lib/appCreate.js';
import { trimStrings } from './lib/middleware/trimStrings.js';
import { validatePageNumber } from './lib/middleware/validatePageNumber.js';

// Routers
import notes from './routers/internal/notes.js';
import purchases from './routers/internal/purchases.js';
import games from './routers/internal/games.js';
import timetracking from './routers/internal/timetracking.js';
import listens from './routers/internal/listens.js';
import youtubelikes from './routers/internal/youtubelikes.js';
import weight from './routers/internal/weight.js';
import bookmarks from './routers/internal/bookmarks.js';
import steps from './routers/internal/steps.js';
import food from './routers/internal/food.js';
import frontend from './routers/internal/frontend.js';
import scrobble from './routers/internal/scrobble.js';
import tv from './routers/internal/tv.js';
import films from './routers/internal/films.js';
import books from './routers/internal/books.js';

const log = new Logger('server-int');

const app = appCreate();

app.use(express.static('public'));
app.use(trimStrings);
app.use(validatePageNumber(true));

// Set up routers
app.use('/purchases', purchases);
app.use('/games', games);
app.use('/timetracking', timetracking);
app.use('/listens', listens);
app.use('/youtubelikes', youtubelikes);
app.use('/weight', weight);
app.use('/bookmarks', bookmarks);
app.use('/steps', steps);
app.use('/food', food);
app.use('/scrobble', scrobble);
app.use('/tv', tv);
app.use('/films', films);
app.use('/books', books);
app.use('/notes', notes);
app.use('/', frontend);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
	log.error(err.message, err.code, req.originalUrl);
	if (err.code !== 404) {
		log.error(err.stack);
	}

	res
		.status(err.code || 500)
		.render('internal/error', { error: err });
});

const startServer = () => {
	const port = process.env.TOMBOIS_SERVER_PORT_INTERNAL;
	app.listen(port, () => {
		log.info(`Running on port ${port}`);
	});
};

export default startServer;
