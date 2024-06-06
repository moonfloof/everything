import type { NextFunction, Response } from 'express';
import { MAX_PAGE } from '../../database/constants.js';
import type { RequestFrontend } from '../../types/express.js';

export function validatePageNumber(isInternal = false) {
	return (req: RequestFrontend, _res: Response, next: NextFunction) => {
		if (req.query.page === undefined || Array.isArray(req.query.page)) {
			req.query.page = 0;
			next();
			return;
		}

		const page = Math.max(Number(req.query.page), 0);
		req.query.page = page;

		if (isInternal) {
			next();
			return;
		}

		if (!Number.isSafeInteger(page) || page > MAX_PAGE) {
			throw new Error(`"page" query must be a number between 0 and ${MAX_PAGE}`);
		}

		next();
	};
}
