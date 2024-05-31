import { BlockList } from 'node:net';

const allowed = new BlockList();
allowed.addAddress('127.0.0.1');
allowed.addSubnet('192.168.0.0', 16);
allowed.addSubnet('172.16.0.0', 20);
allowed.addSubnet('10.0.0.0', 24);

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export default (req, res, next) => {
	const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
	const isAllowed = allowed.check(ip, ip.startsWith('::') ? 'ipv6' : 'ipv4');
	if (!isAllowed) {
		res.redirect('/');
		return;
	}
	next();
};
