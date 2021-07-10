import { RECORDS_PER_PAGE } from '../database/constants.js';
import { dayMs, getStartOfDay, isSameDate } from './formatDate.js';

function getElementValue (valueEmpty, dateInProgress) {
	if (typeof valueEmpty === 'function') {
		return valueEmpty(dateInProgress);
	}
	return valueEmpty;
}

/**
 *
 * @param {Object[]} dateArray
 * @param {string}   [dateKey]
 * @param {Object}   [valueEmpty]
 */
export default function addMissingDates (
	input,
	dateKey = 'created_at',
	valueEmpty = { y: 0, min: 0, max: 0 },
) {
	if (Array.isArray(input) === false || input.length <= 1) {
		return [];
	}

	const sortedInput = input.map(elm => ({
		...elm,
		[dateKey]: new Date(elm[dateKey]),
	}));
	sortedInput.sort((a, b) => b[dateKey] - a[dateKey]);

	const startDate = getStartOfDay(sortedInput[0][dateKey]);
	const endDate = getStartOfDay(sortedInput[sortedInput.length - 1][dateKey]);

	const dateArray = [];
	let dateInProgress = startDate;
	let inputIndex = 0;
	let limit = RECORDS_PER_PAGE;

	while (dateInProgress.getTime() >= endDate.getTime() && --limit > 0) {
		if (isSameDate(dateInProgress, sortedInput[inputIndex][dateKey])) {
			dateArray.push({
				...sortedInput[inputIndex],
				[dateKey]: dateInProgress,
			});
			inputIndex += 1;
		} else {
			dateArray.push({
				[dateKey]: dateInProgress,
				...getElementValue(valueEmpty, dateInProgress),
			});
		}

		dateInProgress = new Date(dateInProgress.getTime() - dayMs);
	}

	return dateArray;
}
