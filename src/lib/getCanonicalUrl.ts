import type { Request } from 'express';
import type { RequestFrontend } from '../types/express.js';
import { config } from './config.js';

/** Gets the full express request URL, *without* query strings */
export function getCanonicalUrl(req: Request | RequestFrontend) {
	const { serverExternalUri } = config;
	return `${serverExternalUri}${req.baseUrl}${req.path}`;
}
