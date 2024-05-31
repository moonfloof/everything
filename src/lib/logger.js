import util from 'node:util';
import { formatDateTime } from './formatDate.js';

const levels = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

const formats = {
	object: '%o',
	number: '%d',
	default: '%s',
};

export default class Logger {
	constructor(label) {
		this._label = label;
	}

	/** @param {string} currentLevel Level used by the logging function */
	static atLevel(currentLevel) {
		const activeLevel = currentLevel || 'debug';
		const targetLevel = levels[process.env.LOG_LEVEL] !== undefined ? process.env.LOG_LEVEL : 'debug';

		return levels[activeLevel] >= levels[targetLevel];
	}

	/**
	 * @param {string} level One of debug, info, warn, error
	 * @param {any[]}  args  Items to print
	 */
	format(level, args) {
		const timestamp = formatDateTime(new Date());
		const argTypes = args.map(a => formats[typeof a] || formats.default).join(' ');
		const formatted = util.format(argTypes, ...args);

		return `[${timestamp}] [${this._label}] [${level}] ${formatted}`;
	}

	log(...args) {
		if (!Logger.atLevel('debug')) return;
		console.debug(this.format('debug', args));
	}

	debug(...args) {
		if (!Logger.atLevel('debug')) return;
		console.debug(this.format('debug', args));
	}

	info(...args) {
		if (!Logger.atLevel('info')) return;
		console.info(this.format('info', args));
	}

	warn(...args) {
		if (!Logger.atLevel('warn')) return;
		console.warn(this.format('warn', args));
	}

	error(...args) {
		if (!Logger.atLevel('error')) return;
		console.error(this.format('error', args));
	}
}
