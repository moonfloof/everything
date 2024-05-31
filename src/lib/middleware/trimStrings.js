/**
 * @param {import('express').Request} req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 */
export function trimStrings(req, _res, next) {
	if (req.body) {
		for (const key of Object.keys(req.body)) {
			if (typeof req.body[key] !== 'string') return;
			req.body[key] = req.body[key].trim();
		}
	}

	next();
}
