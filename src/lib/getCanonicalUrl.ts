import type { Request } from 'express';
import type { RequestFrontend } from '../types/express.js';

/** Gets the full express request URL, *without* query strings */
export function getCanonicalUrl(req: Request | RequestFrontend) {
	return `${process.env.TOMBOIS_SERVER_EXTERNAL_URI}${req.baseUrl}${req.path}`;
}
