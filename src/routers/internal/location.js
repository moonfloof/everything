import express from 'express';
import { dayMs, formatDate } from '../../lib/formatDate.js';
import { getLocationHistory } from '../../database/locations.js';

const router = express.Router();

router.get('/', (req, res) => {
	const {
		date_start = formatDate(new Date(Date.now() - (7 * dayMs))),
		date_end = formatDate(new Date()),
	} = req.query;

	const dateRegex = new RegExp(/^\d{4}-\d{2}-\d{2}$/);

	if (!dateRegex.test(date_start) || !dateRegex.test(date_end)) {
		throw new Error('Date Start and End must be an ISO date formatted string (eg. "2024-01-02"');
	}

	const location = getLocationHistory(date_start, date_end);

	const avgLat = location.reduce((acc, cur) => acc + cur.lat, 0) / location.length;
	const avgLong = location.reduce((acc, cur) => acc + cur.long, 0) / location.length;

	// const paths = [ [] ];
	const points = [];
	// location.forEach(location => {
	// 	const pathIndex = paths.length - 1;

	// 	// Always add the path if it's currently empty
	// 	if (paths[pathIndex].length === 0) {
	// 		if (location.city !== null) {
	// 			points.push({
	// 				latlng: [ location.lat, location.long ],
	// 				title: location.city,
	// 			});
	// 		}
	// 		paths[pathIndex].push([ location.lat, location.long ]);
	// 		return;
	// 	}

	// 	const currentPath = paths[pathIndex];
	// 	const idx = currentPath.length - 1;
	// 	const diffLat = Math.abs(location.lat - currentPath[idx][0]);
	// 	const diffLong = Math.abs(location.long - currentPath[idx][1]);

	// 	// Start a new path for big jumps
	// 	if (diffLat > 0.2 || diffLong > 0.2) {
	// 		if (location.city !== null) {
	// 			points.push({
	// 				latlng: [ location.lat, location.long ],
	// 				title: location.city,
	// 			});
	// 		}
	// 		if (paths[pathIndex].length === 1) {
	// 			paths.pop();
	// 		}
	// 		paths.push([ [ location.lat, location.long ] ]);
	// 		return;
	// 	}

	// 	// Skip very minor movements, to reduce noise and response size.
	// 	if (diffLat < 0.0001 || diffLong < 0.0001) {
	// 		return;
	// 	}

	// 	paths[pathIndex].push([ location.lat, location.long ]);
	// });

	// This is some weird calculation I determined in Excel that smoothly
	// goes from 1.0 to 0.3 between 0 and 100000 points, in a curve, based
	// on the following formula (assuming it's clamped at 100000)
	// =(POWER(((100000 - x) / 10000), 2) / 142.857142857) + 0.3
	const intensity = location.length <= 100000
		? (Math.pow((100000 - location.length) / 10000, 2) / 142.857142857) + 0.3
		: 0.3;

	const paths = location.map(loc => [ loc.lat, loc.long, intensity ]);

	res.render('internal/location', {
		avgLat,
		avgLong,
		paths: JSON.stringify(paths),
		points: JSON.stringify(points),
	});
});

export default router;
