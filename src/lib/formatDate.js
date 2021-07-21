/**
 * @param {string} str
 * @param {number} length
 * @param {string} pad
 */
function padString (str, length, pad = '0') {
	let newStr = str.toString();
	while (newStr.length < length) {
		newStr = `${pad}${newStr}`;
	}
	return newStr;
}

/** @param {Date} date */
export default function formatDate (date) {
	const year = padString(date.getFullYear(), 4);
	const mon = padString(date.getMonth() + 1, 2);
	const day = padString(date.getDate(), 2);

	const hour = padString(date.getHours(), 2);
	const mins = padString(date.getMinutes(), 2);
	const secs = padString(date.getSeconds(), 2);

	return `${year}-${mon}-${day} ${hour}:${mins}:${secs}`;
}

const months = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
];

/** @param {Date} date */
export function prettyDate (date) {
	const year = padString(date.getFullYear(), 4);
	const month = months[date.getMonth()];
	const day = date.getDate();
	let th = 'th';
	if (day % 10 === 1) th = 'st';
	if (day % 10 === 2) th = 'nd';
	if (day % 10 === 3) th = 'rd';

	return `${day}${th} ${month}, ${year}`;
}
