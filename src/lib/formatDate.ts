// Date constants
export const minuteSecs = 60;
export const hourSecs = 60 * minuteSecs;
export const daySecs = 24 * hourSecs;
export const weekSecs = 7 * daySecs;

// Date constants in milliseconds
export const minuteMs = minuteSecs * 1000;
export const hourMs = hourSecs * 1000;
export const dayMs = daySecs * 1000;
export const weekMs = weekSecs * 1000;

export function padString(str: string | number, length: number, pad = '0') {
	let newStr = str.toString();
	while (newStr.length < length) {
		newStr = `${pad}${newStr}`;
	}
	return newStr;
}

export function formatTime(date: Date, includeSeconds = true) {
	const hour = padString(date.getHours(), 2);
	const mins = padString(date.getMinutes(), 2);
	const secs = padString(date.getSeconds(), 2);

	let formatted = `${hour}:${mins}`;

	if (includeSeconds) {
		formatted += `:${secs}`;
	}

	return formatted;
}

export function formatDate(date: Date) {
	const year = padString(date.getFullYear(), 4);
	const mon = padString(date.getMonth() + 1, 2);
	const day = padString(date.getDate(), 2);

	return `${year}-${mon}-${day}`;
}

export function formatDateTime(date: Date, isIso = false) {
	return `${formatDate(date)}${isIso ? 'T' : ' '}${formatTime(date)}`;
}

export function formatDateTimeWithTimezone(date: Date, timezoneOffsetMinutes = 0) {
	const { sign, hours, minutes } = formatDuration(timezoneOffsetMinutes * minuteMs);
	const timezoneString = `${sign < 0 ? '-' : '+'}${padString(hours, 2)}:${padString(minutes, 2)}`;
	return `${formatDate(date)}T${formatTime(date)}${timezoneString}`;
}

export const months = [
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

export const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function prettyDate(date: Date) {
	const year = padString(date.getFullYear(), 4);
	const month = months[date.getMonth()];
	const day = date.getDate();
	let th = 'th';
	if (day % 10 === 1) th = 'st';
	if (day % 10 === 2) th = 'nd';
	if (day % 10 === 3) th = 'rd';

	return `${day}${th} ${month}, ${year}`;
}

export function shortDate(date: Date) {
	const day = padString(date.getDate(), 2);
	const month = padString(date.getMonth() + 1, 2);

	return `${day}/${month}`;
}

function formatDuration(durationMs: number) {
	const sign = Math.sign(durationMs);

	// 60 mins * 60 secs * 1000 ms
	const hoursTotal = Math.abs(durationMs) / hourMs;

	// Calculate minutes based on decimal from hours
	const hours = Math.floor(hoursTotal);
	const minutes = Math.round((hoursTotal - hours) * 60);

	return { hours, minutes, sign };
}

export function prettyDuration(durationMs: number) {
	const { hours, minutes } = formatDuration(durationMs);
	return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function msToIsoDuration(durationMs: number) {
	// 60 mins * 60 secs * 1000 ms
	const hoursTotal = durationMs / 3600000;

	// Calculate minutes based on decimal from hours
	const hoursRounded = Math.floor(hoursTotal);
	const minutes = Math.round((hoursTotal - hoursRounded) * 60);

	let output = 'PT';

	if (hoursRounded > 0) {
		output += `${padString(hoursRounded, 2)}H`;
	}

	if (minutes > 0) {
		output += `${padString(minutes, 2)}M`;
	}

	return output;
}

export function isoDurationToSeconds(durationPT: string | undefined | null): number | null {
	if (durationPT === '' || durationPT === undefined || durationPT === null) {
		return null;
	}

	// If we've just passed in a plain old number,
	// assume it's... a plain old number.
	if (!Number.isNaN(Number(durationPT))) {
		return Number(durationPT);
	}

	const regex = new RegExp(/^PT(?:(?<hours>\d+)H)?(?:(?<minutes>\d+)M)?(?:(?<seconds>\d+)S)?$/);
	const duration = durationPT.match(regex);
	if (duration === null) {
		return null;
	}

	const { hours, minutes, seconds } = duration.groups ?? {};
	const hoursNumber = Number(hours ?? 0) * 3600;
	const minutesNumber = Number(minutes ?? 0) * 60;
	const secondsNumber = Number(seconds ?? 0);

	return hoursNumber + minutesNumber + secondsNumber;
}

export function getStartOfDay(date = new Date()) {
	return new Date(`${formatDate(date)}T00:00:00.000Z`);
}

export function isSameDate(dateA: Date, dateB: Date) {
	const yearSame = dateA.getFullYear() === dateB.getFullYear();
	if (yearSame === false) return false;

	const monthSame = dateA.getMonth() === dateB.getMonth();
	if (monthSame === false) return false;

	const daySame = dateA.getDate() === dateB.getDate();
	if (daySame === false) return false;

	return true;
}

export function dateDefault(input: string | number | Date | undefined | null) {
	return new Date(input || Date.now()).toISOString();
}
