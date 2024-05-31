import path from 'node:path';
import { logEntry, rawBody } from '@tombofry/stdlib/src/express/index.js';
import express from 'express';
import { engine } from 'express-handlebars';
import formBodyParser from './formParser.js';
import { helpers } from './handlebarsExtensions.js';

const appCreate = () => {
	const app = express();
	app.use(rawBody);
	app.use((req, _res, next) => {
		try {
			req.body = JSON.parse(req.rawBody);
		} catch (err) {
			/* Do nothing */
		}
		try {
			if (!req.body) {
				req.body = formBodyParser(req.rawBody);
			}
		} catch (err) {
			/* do nothing */ console.error(err);
		}

		next();
	});
	app.use(logEntry(console.info));

	// Set up frontend
	app.engine('.hbs', engine({ extname: '.hbs', helpers }));
	app.set('views', path.resolve('src/views'));
	app.set('view engine', '.hbs');

	return app;
};

export default appCreate;
