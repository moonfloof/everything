import { timeago } from '../adapters/timeago.js';
import { dayMs, formatTime, getStartOfDay, hourMs, prettyDate, prettyDuration, shortDate } from '../lib/formatDate.js';
import { type Parameters, calculateGetParameters } from './constants.js';
import { getStatement } from './database.js';
import { CATEGORIES, type Timetracking } from './timetracking.js';

interface SleepStats {
	longest: number;
	longestHuman: string | null;
	shortest: number;
	shortestHuman: string | null;
	cumulativeSleepStart: number;
	cumulativeSleepEnd: number;
	cumulativeDuration: number;
	averageSleepStartHuman: string;
	averageSleepEndHuman: string;
	averageDurationHuman: string;
}

export function getSleepCycles(parameters: Partial<Parameters>) {
	const statement = getStatement<Timetracking>(
		'getSleepCycles',
		`SELECT * FROM timetracking
		WHERE
			id LIKE $id AND
			category = '${CATEGORIES.SLEEP}' AND
			created_at >= $created_at
		ORDER BY created_at DESC
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters)).map(row => {
		const created_at = new Date(row.created_at).getTime();
		const ended_at = row.ended_at ? new Date(row.ended_at).getTime() : null;

		const startTimeMs = created_at % dayMs;
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
			timeago: timeago.format(created_at),
			duration,
			durationNumber,
			startTimeNormalised,
			dateFull: prettyDate(new Date(ended_at ?? created_at)),
			dateShort: shortDate(new Date(ended_at ?? created_at)),
		};
	});
}

export function getSleepStats() {
	const emptyStats: SleepStats = {
		longest: 0,
		longestHuman: '',
		shortest: 100,
		shortestHuman: '',
		cumulativeSleepStart: 0,
		cumulativeSleepEnd: 0,
		cumulativeDuration: 0,
		averageDurationHuman: '',
		averageSleepEndHuman: '',
		averageSleepStartHuman: '',
	};

	const sleepCycles = getSleepCycles({ days: 100 }).slice(0, 10);

	if (sleepCycles.length === 0) return emptyStats;

	const stats = sleepCycles.reduce((stats, sleep) => {
		// Skip currently sleeping
		if (sleep.durationNumber === 0) return stats;

		if (sleep.durationNumber > stats.longest) {
			stats.longest = sleep.durationNumber;
			stats.longestHuman = sleep.duration;
		}

		if (sleep.durationNumber < stats.shortest) {
			stats.shortest = sleep.durationNumber;
			stats.shortestHuman = sleep.duration;
		}

		stats.cumulativeSleepStart += sleep.startTimeNormalised;
		stats.cumulativeSleepEnd += sleep.startTimeNormalised + sleep.durationNumber;
		stats.cumulativeDuration += sleep.durationNumber;

		return stats;
	}, emptyStats);

	const averageSleep = (stats.cumulativeSleepStart / sleepCycles.length) * hourMs;
	const averageWake = (stats.cumulativeSleepEnd / sleepCycles.length) * hourMs;
	const averageDuration = (stats.cumulativeDuration / sleepCycles.length) * hourMs;

	// Use today for the correct timezone
	const today = getStartOfDay().getTime();

	stats.averageSleepStartHuman = formatTime(new Date(today + averageSleep), false);
	stats.averageSleepEndHuman = formatTime(new Date(today + averageWake), false);
	stats.averageDurationHuman = prettyDuration(averageDuration);

	return stats;
}
