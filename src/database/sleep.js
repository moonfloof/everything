import { getStatement } from './database.js';
import TimeAgo from '../adapters/timeago.js';
import { dayMs, hourMs, formatTime, prettyDate, prettyDuration, shortDate, getStartOfDay } from '../lib/formatDate.js';
import { calculateGetParameters } from './constants.js';
import { CATEGORIES } from './timetracking.js';

/**
 * Fetch all sleep cycles, or one, based on a specific ID
 *
 * @export
 * @param {object} parameters
 * @param {string} [parameters.id]
 * @param {number} [parameters.page]
 * @param {number} [parameters.limit]
 * @param {number} [parameters.days]
 */
export function getSleepCycles (parameters) {
	const statement = getStatement(
		'getSleepCycles',
		`SELECT * FROM timetracking
		WHERE
			id LIKE $id AND
			category = '${CATEGORIES.SLEEP}' AND
			created_at >= $created_at
		ORDER BY created_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement
		.all(calculateGetParameters(parameters))
		.map(row => {
			const created_at = new Date(row.created_at);
			const ended_at = row.ended_at ? new Date(row.ended_at) : null;
			const timeago = TimeAgo.format(created_at);

			const startTimeMs = (created_at.getTime() % dayMs);
			const twelveHours = 12 * hourMs;
			const startTimeNormalised = (((startTimeMs + twelveHours) % dayMs) - twelveHours) / hourMs;

			let duration = null;
			let durationNumber = 0;

			if (ended_at !== null) {
				// Difference between start and end, in milliseconds
				const diff = ended_at - created_at;
				duration = prettyDuration(diff);

				// Hours as a decimal (eg. `7.56`)
				durationNumber = diff / 3600000;
			}

			return {
				...row,
				timeago,
				duration,
				durationNumber,
				startTimeNormalised,
				dateFull: prettyDate(ended_at ?? created_at),
				dateShort: shortDate(ended_at ?? created_at),
			};
		});
}

export function getSleepStats () {
	const emptyStats = {
		longest: 0,
		longestHuman: '',
		shortest: 100,
		shortestHuman: '',
		cumulativeSleepStart: 0,
		cumulativeSleepEnd: 0,
		cumulativeDuration: 0,
	};

	const sleep = getSleepCycles({ days: 100 }).slice(0, 10);

	if (sleep.length === 0) return emptyStats;

	const stats = sleep.reduce((acc, cur) => {
		let newAcc = { ...acc };

		// Skip currently sleeping
		if (cur.durationNumber === 0) return newAcc;

		if (cur.durationNumber > acc.longest) {
			newAcc.longest = cur.durationNumber;
			newAcc.longestHuman = cur.duration;
		}

		if (cur.durationNumber < acc.shortest) {
			newAcc.shortest = cur.durationNumber;
			newAcc.shortestHuman = cur.duration;
		}

		newAcc.cumulativeSleepStart += cur.startTimeNormalised;
		newAcc.cumulativeSleepEnd += cur.startTimeNormalised + cur.durationNumber;
		newAcc.cumulativeDuration += cur.durationNumber;

		return newAcc;
	}, emptyStats);

	const averageSleep = (stats.cumulativeSleepStart / sleep.length) * hourMs;
	const averageWake = (stats.cumulativeSleepEnd / sleep.length) * hourMs;
	const averageDuration = (stats.cumulativeDuration / sleep.length) * hourMs;

	// Use today for the correct timezone
	const today = getStartOfDay().getTime();

	stats.averageSleepStartHuman = formatTime(new Date(today + averageSleep), false);
	stats.averageSleepEndHuman = formatTime(new Date(today + averageWake), false);
	stats.averageDurationHuman = prettyDuration(averageDuration);

	return stats;
}
