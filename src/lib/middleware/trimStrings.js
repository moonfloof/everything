export function trimStrings (req, _res, next) {
	if (req.body) {
		Object.keys(req.body).forEach(key => {
			if (typeof req.body[key] !== 'string') return;
			req.body[key] = req.body[key].trim();
		});
	}

	next();
}
