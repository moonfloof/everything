/**
 * Gets the full express request URL, *without* query strings
 * @param {import('express').Request} req
 */
export function getCanonicalUrl (req) {
	return `${req.protocol}://${req.hostname}${req.baseUrl}${req.path}`;
}
