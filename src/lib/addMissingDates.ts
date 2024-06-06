import { RECORDS_PER_PAGE } from '../database/constants.js';
import { dayMs, getStartOfDay, isSameDate } from './formatDate.js';

/** Takes an array of dates and adds valueEmpty to any missing dates */
export default function addMissingDates<T extends object = Record<string, string | number>>(
	input: (T & { day: Date })[],
	getEmptyValue: (day: Date) => T,
): T[] {
	if (input.length <= 1) {
		return input;
	}

	input.sort((a, b) => b.day.getTime() - a.day.getTime());

	const startDate = getStartOfDay(input[0].day);
	const endDate = getStartOfDay(input[input.length - 1].day);

	const dateArray = [];
	let dateInProgress = startDate;
	let inputIndex = 0;
	let limit = RECORDS_PER_PAGE;

	while (dateInProgress.getTime() >= endDate.getTime() && --limit > 0) {
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
