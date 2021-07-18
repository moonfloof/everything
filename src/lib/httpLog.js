import onFinished from 'on-finished';
import Logger from './logger.js';

const log = new Logger('http');

function reqIpAddress (req) {
	const ip = req.headers['x-forwarded-for'] ||
		req.ip ||
		req._remoteAddress ||
		req.connection?.remoteAddress ||
		'';

	return ip.split(',')[0];
}

function resContentLength (res) {
	return res.getHeader('content-length');
}

function getString (req, res) {
	let str = '';

	const ip = reqIpAddress(req);
	const size = (Number(resContentLength(res)) || 0) / 1000;
	const duration = Date.now() - req.startTimestamp;

	// Client Information
	str += ip;

	// Request Information
	str += ` - "${req.method} ${req.originalUrl}"`;

	// Response Information
	str += ` - ${res.statusCode || 'XXX'} ${duration}ms ${size}kB`;

	return str;
}

/**
 * Create a log entry string for requests made to an express server
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {Function} next
 * @returns {Promise<String>} A string
 */
const logEntry = (req, res, next) => new Promise((resolve, reject) => {
	req.startTimestamp = Date.now();
	onFinished(res, (err, resFinished) => {
		if (err) return reject(err);
		log.info(getString(req, resFinished));
		return resolve();
	});
	next();
});

export default logEntry;
