import { RECORDS_PER_PAGE } from '../database/constants.js';
import { dayMs, getStartOfDay, isSameDate } from './formatDate.js';

/** Takes an array of dates and adds valueEmpty to any missing dates */
export default function addMissingDates<T extends Record<string, string | number | Date> & { day: Date }>(
	input: T[],
	getEmptyValue: (day: Date) => T,
	limit = RECORDS_PER_PAGE,
): T[] {
	if (input.length <= 1) {
		return input;
	}

	input.sort((a, b) => b.day.getTime() - a.day.getTime());

	const startDate = getStartOfDay(input[0].day);
	const endDate = getStartOfDay(input[input.length - 1].day);

	const dateArray: T[] = [];
	let dateInProgress = startDate;
	let inputIndex = 0;
	let limitReal = limit;

	while (dateInProgress.getTime() >= endDate.getTime() && --limitReal > 0) {
		if (isSameDate(dateInProgress, input[inputIndex].day)) {
			dateArray.push({
				...input[inputIndex],
				day: dateInProgress,
			});
			inputIndex += 1;
		} else {
			dateArray.push({
				...getEmptyValue(dateInProgress),
				day: dateInProgress,
			});
		}

		dateInProgress = new Date(dateInProgress.getTime() - dayMs);
	}

	return dateArray;
}
