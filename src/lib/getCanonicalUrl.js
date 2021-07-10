/**
 * Gets the full express request URL, *without* query strings
 * @param {import('express').Request} req
 */
export function getCanonicalUrl (req) {
	return `${process.env.TOMBOIS_SERVER_EXTERNAL_URI}${req.baseUrl}${req.path}`;
}
