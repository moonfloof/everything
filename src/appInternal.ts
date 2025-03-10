import { errors } from '@moonfloof/stdlib';
const { NotFoundError } = errors;
import type { HTTPError } from '@moonfloof/stdlib/types/errors/http.js';
import express, { type NextFunction, type Request, type Response } from 'express';
import appCreate from './lib/appCreate.js';
import Logger from './lib/logger.js';
import { trimStrings } from './lib/middleware/trimStrings.js';
import { validatePageNumber } from './lib/middleware/validatePageNumber.js';

// Routers
import bookmarks from './routers/internal/bookmarks.js';
import books from './routers/internal/books.js';
import cache from './routers/internal/cache.js';
import checkins from './routers/internal/checkins.js';
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
import { config } from './lib/config.js';

const log = new Logger('server-int');

const app = appCreate();

app.use(express.static('public'));
app.use(trimStrings);
app.use(validatePageNumber(true));

// Set up routers
app.use('/', frontend);
app.use('/bookmarks', bookmarks);
app.use('/books', books);
app.use('/checkins', checkins);
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
app.use('/cache', cache);

app.get('*url', () => {
	throw new NotFoundError('Page Not Found');
});

app.use((err: HTTPError, req: Request, res: Response, _next: NextFunction) => {
	log.error(err.message, err.code ?? '', req.originalUrl);
	if (err.code !== 404) {
		log.error(err.stack);
	}

	res.status(err.code || 500).render('internal/error', { error: err });
});

const startServer = () => {
	const { portInternal } = config;
	app.listen(portInternal, () => {
		log.info(`Running on port ${portInternal}`);
	});
};

export default startServer;
