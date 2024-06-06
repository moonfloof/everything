import type { NextFunction, Request, Response } from 'express';

export function trimStrings(req: Request, _res: Response, next: NextFunction) {
	if (!req.body) {
		next();
		return;
	}

	for (const key of Object.keys(req.body)) {
		if (typeof req.body[key] !== 'string') continue;
		req.body[key] = req.body[key].trim();
	}

	next();
}
