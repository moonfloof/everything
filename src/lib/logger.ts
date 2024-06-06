import { format } from 'node:util';
import { formatDateTime } from './formatDate.js';

const LEVELS = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
} as const;

type Level = keyof typeof LEVELS;

const FORMATS = new Map([
	['object', '%o'],
	['number', '%d'],
	['bigint', '%d'],
	['default', '%s'],
]);

export default class Logger {
	#label: string;

	constructor(label: string) {
		this.#label = label;
	}

	static atLevel(currentLevel: Level) {
		const activeLevel = currentLevel || 'debug';
		const envLevel = (process.env.LOG_LEVEL as Level) || 'debug';
		const targetLevel = LEVELS[envLevel] !== undefined ? envLevel : 'debug';

		return LEVELS[activeLevel] >= LEVELS[targetLevel];
	}

	// biome-ignore lint/suspicious/noExplicitAny: We can have anything be logged.
	format(level: string, args: any[]) {
		const timestamp = formatDateTime(new Date());
		const argTypes = args.map(a => FORMATS.get(typeof a) || FORMATS.get('default')).join(' ');
		const formatted = format(argTypes, ...args);

		return `[${timestamp}] [${this.#label}] [${level}] ${formatted}`;
	}

	// biome-ignore lint/suspicious/noExplicitAny: We can have anything be logged.
	log(...args: any[]) {
		if (!Logger.atLevel('debug')) return;
		console.debug(this.format('debug', args));
	}

	// biome-ignore lint/suspicious/noExplicitAny: We can have anything be logged.
	debug(...args: any[]) {
		if (!Logger.atLevel('debug')) return;
		console.debug(this.format('debug', args));
	}

	// biome-ignore lint/suspicious/noExplicitAny: We can have anything be logged.
	info(...args: any[]) {
		if (!Logger.atLevel('info')) return;
		console.info(this.format('info', args));
	}

	// biome-ignore lint/suspicious/noExplicitAny: We can have anything be logged.
	warn(...args: any[]) {
		if (!Logger.atLevel('warn')) return;
		console.warn(this.format('warn', args));
	}

	// biome-ignore lint/suspicious/noExplicitAny: We can have anything be logged.
	error(...args: any[]) {
		if (!Logger.atLevel('error')) return;
		console.error(this.format('error', args));
	}
}
