import express from 'express';
import { getLocationHistory } from '../../database/locations.js';
import { dayMs, formatDate } from '../../lib/formatDate.js';

const router = express.Router();

const DISPLAY_FORMATS = {
	LINES: 'lines',
	HEATMAP: 'heatmap',
};

/**
 * @param {{lat: number, long: number}[]} locationHistory
 * @return {[number, number][]}
 */
const generatePathLines = locationHistory => {
	const paths = [[]];

	for (const location of locationHistory) {
		const pathIndex = paths.length - 1;

		// Always add the path if it's currently empty
		if (paths[pathIndex].length === 0) {
			paths[pathIndex].push([location.lat, location.long]);
			continue;
		}

		const currentPath = paths[pathIndex];
		const idx = currentPath.length - 1;
		const diffLat = Math.abs(location.lat - currentPath[idx][0]);
		const diffLong = Math.abs(location.long - currentPath[idx][1]);

		// Start a new path for big jumps
		if (diffLat > 0.2 || diffLong > 0.2) {
			if (paths[pathIndex].length === 1) {
				paths.pop();
			}
			paths.push([[location.lat, location.long]]);
			continue;
		}

		// Skip very minor movements, to reduce noise and response size.
		if (diffLat < 0.0001 || diffLong < 0.0001) {
			continue;
		}

		paths[pathIndex].push([location.lat, location.long]);
	}

	return paths;
};

router.get('/', (req, res) => {
	const {
		date_start = formatDate(new Date(Date.now() - 7 * dayMs)),
		date_end = formatDate(new Date()),
		format = DISPLAY_FORMATS.HEATMAP,
	} = req.query;

	const dateRegex = new RegExp(/^\d{4}-\d{2}-\d{2}$/);

	if (!dateRegex.test(date_start) || !dateRegex.test(date_end)) {
		throw new Error('Date Start and End must be an ISO date formatted string (eg. "2024-01-02"');
	}

	const dateStartDate = new Date(date_start);
	const dateEndDate = new Date(date_end);

	if (dateEndDate < dateStartDate) {
		throw new Error('Date End cannot be before Date Start');
	}

	const locationHistory = getLocationHistory(dateStartDate, dateEndDate);

	const avgLat = locationHistory.reduce((acc, cur) => acc + cur.lat, 0) / locationHistory.length;
	const avgLong = locationHistory.reduce((acc, cur) => acc + cur.long, 0) / locationHistory.length;

	let paths = [];

	if (format === DISPLAY_FORMATS.HEATMAP) {
		// This is some weird calculation I determined in Excel that smoothly
		// goes from 1.0 to 0.3 between 0 and 100000 points, in a curve, based
		// on the following formula (assuming it's clamped at 100000)
		// =(POWER(((100000 - x) / 10000), 2) / 142.857142857) + 0.3
		const intensity =
			locationHistory.length <= 100000
				? ((100000 - locationHistory.length) / 10000) ** 2 / 142.857142857 + 0.3
				: 0.3;

		paths = locationHistory.map(loc => [loc.lat, loc.long, intensity]);
	} else {
		paths = generatePathLines(locationHistory);
	}

	res.render('internal/location', {
		avgLat,
		avgLong,
		paths: JSON.stringify(paths),
		pointsTotal: locationHistory.length,
		format,
		dateToday: formatDate(new Date()),
		date_start,
		date_end,
		formatOptions: Object.values(DISPLAY_FORMATS).map(option => ({
			value: option,
			selected: option === format,
		})),
	});
});

export default router;
