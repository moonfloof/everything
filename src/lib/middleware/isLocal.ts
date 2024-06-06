import { BlockList } from 'node:net';
import type { NextFunction, Request, Response } from 'express';

const allowed = new BlockList();
allowed.addAddress('127.0.0.1');
allowed.addSubnet('192.168.0.0', 16);
allowed.addSubnet('172.16.0.0', 20);
allowed.addSubnet('10.0.0.0', 24);

export function isLocal(req: Request, res: Response, next: NextFunction) {
	let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

	if (Array.isArray(ip)) {
		ip = ip.join('');
	}

	const isAllowed = allowed.check(ip, ip.startsWith('::') ? 'ipv6' : 'ipv4');
	if (!isAllowed) {
		res.redirect('/');
		return;
	}
	next();
}
