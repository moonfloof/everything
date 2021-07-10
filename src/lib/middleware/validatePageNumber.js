import { MAX_PAGE } from '../../database/constants.js';

export function validatePageNumber (isInternal = false) {
	/**
	 * @param {import('express').Request} req
	 * @param {import('express').Response} _res
	 * @param {import('express').NextFunction} next
	 */
	return (req, _res, next) => {
		if (req.query.page === undefined) {
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
