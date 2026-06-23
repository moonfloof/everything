import cron, { type ScheduledTask } from 'node-cron';
import { timeago } from '../../adapters/timeago.js';
import { minuteMs } from '../formatDate.js';

type CronName = 'bluesky' | 'cache' | 'geocoder' | 'letterboxd' | 'psn' | 'retroachievements' | 'steam';
type IntervalTask = {
	timeout: ReturnType<typeof setInterval>;
	intervalMs: number;
};

const jobs: Record<CronName, ScheduledTask | IntervalTask | null> = {
	bluesky: null,
	cache: null,
	geocoder: null,
	letterboxd: null,
	psn: null,
	retroachievements: null,
	steam: null,
};

export async function stopCron(name: CronName) {
	let task = jobs[name];

	if (task === null) return;

	if ('intervalMs' in task) {
		clearInterval(task.intervalMs);
		task = null;
		jobs[name] = null;
		return;
	}

	await task.stop();
	await task.destroy();
	task = null;
	jobs[name] = null;
}

export function startOrRestartCron(name: CronName, schedule: string, fn: () => void) {
	stopCron(name);
	jobs[name] = cron.schedule(schedule, fn, { name });
}

export function startOrRestartInterval(name: CronName, intervalMs: number, fn: () => void) {
	stopCron(name);
	const job: IntervalTask = {
		timeout: setInterval(fn, intervalMs),
		intervalMs,
	};
	jobs[name] = job;
}

function getJobStatus(name: CronName) {
	const job = jobs[name];
	if (job === null) {
		return null;
	}

	if ('getNextRun' in job) {
		const runDate = job.getNextRun();
		if (runDate === null) return null;

		return timeago.format(runDate);
	}

	return `every ${Math.floor(job.intervalMs / minuteMs)} minutes (precise info not available)`;
}

export function getJobs() {
	return Object.keys(jobs).map(name => {
		let configPage = name;
		if (name === 'geocoder') configPage = 'location';
		if (name === 'cache') configPage = 'server';
		return {
			name,
			configPage,
			status: getJobStatus(name as CronName),
		};
	});
}
