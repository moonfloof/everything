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

	const paths = [ [] ];
	const points = [];

	const location = getLocationHistory(date_start, date_end);

	const avgLat = location.reduce((acc, cur) => acc + cur.lat, 0) / location.length;
	const avgLong = location.reduce((acc, cur) => acc + cur.long, 0) / location.length;

	location.forEach(location => {
		const pathIndex = paths.length - 1;

		// Always add the path if it's currently empty
		if (paths[pathIndex].length === 0) {
			if (location.city !== null) {
				points.push({
					latlng: [ location.lat, location.long ],
					title: location.city,
				});
			}
			paths[pathIndex].push([ location.lat, location.long ]);
			return;
		}

		const currentPath = paths[pathIndex];
		const idx = currentPath.length - 1;
		const diffLat = Math.abs(location.lat - currentPath[idx][0]);
		const diffLong = Math.abs(location.long - currentPath[idx][1]);

		// Start a new path for big jumps
		if (diffLat > 0.2 || diffLong > 0.2) {
			if (location.city !== null) {
				points.push({
					latlng: [ location.lat, location.long ],
					title: location.city,
				});
			}
			if (paths[pathIndex].length === 1) {
				paths.pop();
			}
			paths.push([ [ location.lat, location.long ] ]);
			return;
		}

		// Skip very minor movements, to reduce noise and response size.
		if (diffLat < 0.0001 || diffLong < 0.0001) {
			return;
		}

		paths[pathIndex].push([ location.lat, location.long ]);
	});

	res.render('internal/location', {
		avgLat,
		avgLong,
		paths: JSON.stringify(paths),
		points: JSON.stringify(points),
	});
});

export default router;
