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

	format(level: string, args: unknown[]) {
		const timestamp = formatDateTime(new Date());
		const argTypes = args.map(a => FORMATS.get(typeof a) || FORMATS.get('default')).join(' ');
		const formatted = format(argTypes, ...args);

		return `[${timestamp}] [${this.#label}] [${level}] ${formatted}`;
	}

	log(...args: unknown[]) {
		if (!Logger.atLevel('debug')) return;
		console.debug(this.format('debug', args));
	}

	debug(...args: unknown[]) {
		if (!Logger.atLevel('debug')) return;
		console.debug(this.format('debug', args));
	}

	info(...args: unknown[]) {
		if (!Logger.atLevel('info')) return;
		console.info(this.format('info', args));
	}

	warn(...args: unknown[]) {
		if (!Logger.atLevel('warn')) return;
		console.warn(this.format('warn', args));
	}

	error(...args: unknown[]) {
		if (!Logger.atLevel('error')) return;
		console.error(this.format('error', args));
	}
}
