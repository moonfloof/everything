import { dayMs, getStartOfDay } from '../lib/formatDate.js';
import { generateBarGraph } from '../lib/graphs/bar.js';
import type { Insert } from '../types/database.js';
import { getStatement } from './database.js';

interface HeartRate {
	rate: number;
	created_at: number;
}

export function insertHeartRate(heartrate: Insert<HeartRate>) {
	const statement = getStatement(
		'insertHeartRate',
		`INSERT INTO health_heartrate
		(rate, created_at)
		VALUES
		($rate, $created_at)`,
	);

	return statement.run(heartrate);
}

export function countHeartRate() {
	const statement = getStatement<{ total: number }>(
		'countHeartRate',
		'SELECT COUNT(*) as total FROM health_heartrate',
	);

	return statement.get()?.total || 0;
}

function lerp(start: number, end: number, amount: number) {
	return (1 - amount) * start + amount * end;
}

function sum(array: number[]): number {
	return array.reduce((acc, cur) => acc + cur, 0);
}

export function getHeartRateAggregate(startDateTime: Date, endDateTime: Date, points = 100): HeartRate[] {
	const statement = getStatement<HeartRate>(
		'getHeartRateAggregate',
		`SELECT rate, created_at
		 FROM health_heartrate
		 WHERE created_at > $startDateTime
		   AND created_at < $endDateTime`,
	);

	const results = statement.all({
		startDateTime: startDateTime.getTime(),
		endDateTime: endDateTime.getTime(),
	});

	// Return what we can, if there aren't enough points
	if (results.length <= points) {
		return results;
	}

	// If there are less than 2x as many results as points, select individual
	// points throughout the array
	if (results.length < points * 2) {
		return Array.from({ length: points }).map((_, index) => {
			const resultsIndex = Math.round(lerp(0, results.length, index / points));
			return results[resultsIndex];
		});
	}

	// Finally, we can start averaging values
	// TODO: Implement an optimised version of this 😳
	return Array.from({ length: points }).map((_, index) => {
		const indexStart = Math.floor(lerp(0, results.length, index / points));
		const indexEnd = Math.floor(lerp(0, results.length, (index + 1) / points));
		const slice = results.slice(indexStart, indexEnd);
		const avg = sum(slice.map(a => a.rate)) / slice.length;
		return {
			created_at: results[indexStart].created_at,
			rate: avg,
		};
	});
}

export function getHeartRateGraphs(days = 7) {
	const graphs = [];

	for (let i = 0; i < days; i++) {
		const startDateTime = getStartOfDay(new Date(Date.now() - (i + 1) * dayMs));
		const endDateTime = getStartOfDay(new Date(Date.now() - i * dayMs));
		const graphData = getHeartRateAggregate(startDateTime, endDateTime, 14);
		graphs.push({
			created_at: endDateTime,
			graph: generateBarGraph(
				graphData.map(p => ({ y: p.rate, label: '' })),
				'heart rate (bpm)',
			),
		});
	}

	return graphs;
}
