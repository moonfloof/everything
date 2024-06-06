import { resolve } from 'node:path';
import { express as expressHelpers } from '@tombofry/stdlib';
import express, { type Request, type RequestHandler } from 'express';
import { engine } from 'express-handlebars';
import formBodyParser from './formParser.js';
import { helpers } from './handlebarsExtensions.js';

interface RequestRawBody extends Request {
	rawBody: string;
}

const appCreate = () => {
	const app = express();
	app.use(expressHelpers.rawBody);
	app.use(((req: RequestRawBody, _res, next) => {
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
	}) as RequestHandler);
	app.use(expressHelpers.logEntry(console.info));

	// Set up frontend
	app.engine('.hbs', engine({ extname: '.hbs', helpers }));
	app.set('views', resolve('src/views'));
	app.set('view engine', '.hbs');
	app.set('query parser', 'simple');

	return app;
};

export default appCreate;
