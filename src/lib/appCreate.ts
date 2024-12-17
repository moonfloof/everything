import { resolve } from 'node:path';
import { express as expressHelpers } from '@tombofry/stdlib';
import express from 'express';
import { engine } from 'express-handlebars';
import { helpers } from './handlebarsExtensions.js';
import { getCanonicalUrl } from './getCanonicalUrl.js';

const appCreate = () => {
	const app = express();
	app.use(expressHelpers.rawBody);
	app.use(expressHelpers.parseRawBody);
	app.use(expressHelpers.logEntry(console.info));
	app.use((req, res, next) => {
		res.locals.isHomepage = req.url === '/';
		res.locals.canonicalUrl = getCanonicalUrl(req);
		next();
	});

	// Set up frontend
	app.engine('.hbs', engine({ extname: '.hbs', helpers }));
	app.set('views', resolve('src/views'));
	app.set('view engine', '.hbs');
	app.set('query parser', 'simple');

	return app;
};

export default appCreate;
