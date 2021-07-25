import path from 'path';
import express from 'express';
import helmet from 'helmet';
import exphbs from 'express-handlebars';
import { rawBody, logEntry } from '@tombofry/stdlib/src/express/index.js';
import formBodyParser from './formParser.js';

const appCreate = () => {
	const app = express();
	app.use(helmet());
	app.use(rawBody);
	app.use((req, _res, next) => {
		try {
			req.body = JSON.parse(req.rawBody);
		} catch (err) { /* Do nothing */ }
		try {
			if (!req.body) {
				req.body = formBodyParser(req.rawBody);
			}
		} catch (err) { /* do nothing */ console.error(err); }

		next();
	});
	app.use(logEntry(console.info));

	// Set up frontend
	app.engine('.hbs', exphbs({ extname: '.hbs' }));
	app.set('views', path.resolve('src/views'));
	app.set('view engine', '.hbs');

	return app;
};

export default appCreate;
