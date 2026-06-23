/**
 * Convert a poll interval into a cron job.
 *
 * This is to move towards making everything a cron job, instead of using
 * `setInterval` to poll everything. It does also mean that any wacky intervals
 * people have set up would not really be supported anymore, so this function
 * approximates them to the nearest 30-60 minute schedules.
 */
export default function convertPollIntervalToCron(pollIntervalMinutes: number): string {
	const interval = Math.round(pollIntervalMinutes);

	// Runs every minute forever.
	if (interval <= 1) {
		return '* * * * *';
	}

	// If less than 30 minutes, let's shortcut it.
	if (interval <= 30) {
		const offset = Math.floor((interval - 1) * Math.random());
		return `${offset}-59/${interval} * * * *`;
	}

	// Any value after 30 minutes and below half a day will round to the nearest
	// hour, because why are you setting your intervals to be weird numbers 😭
	if (interval > 30 && interval < 720) {
		const mn = Math.floor(60 * Math.random());
		const hr = Math.floor(interval / 60);
		return `${mn} */${hr} * * *`;
	}

	// Lastly, if our intervals are longer than half a day, round to the nearest
	// day. I will *not* be tackling values higher than multiple days 😵‍💫

	// Pick a random hour and minute, so we don't always call at midnight.
	const mn = Math.floor(60 * Math.random());
	const hr = Math.floor(24 * Math.random());
	return `${mn} ${hr} * * *`;
}

export function convertUnitToMinutes(interval: number, unit: 'h' | 'm' | 's' | 'ms'): number {
	switch (unit) {
		case 'h':
			return interval * 60;
		case 'm':
			return interval;
		case 's':
			return interval / 60;
		case 'ms':
			return interval / 60000;
	}
}
