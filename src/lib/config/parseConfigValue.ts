import { getConfigValue, setConfigValue } from '../../database/config.js';
import type { ConfigKey } from './config.js';
import convertPollIntervalToCron, { convertUnitToMinutes } from './pollIntervalToCron.js';

type Opt<T> = T | null;

export function parseConfigValue(key: ConfigKey, type: 'string', defaultValue: Opt<string>, isOptional: false): string;
export function parseConfigValue(
	key: ConfigKey,
	type: 'string',
	defaultValue: Opt<string>,
	isOptional: true,
): string | null;
export function parseConfigValue(key: ConfigKey, type: 'number', defaultValue: Opt<number>, isOptional: false): number;
export function parseConfigValue(
	key: ConfigKey,
	type: 'number',
	defaultValue: Opt<number>,
	isOptional: true,
): number | null;
export function parseConfigValue(key: ConfigKey, type: 'bool', defaultValue: Opt<boolean>, isOptional: false): boolean;
export function parseConfigValue(
	key: ConfigKey,
	type: 'bool',
	defaultValue: Opt<boolean>,
	isOptional: true,
): boolean | null;
export function parseConfigValue(key: ConfigKey, type: 'json', defaultValue: unknown, isOptional: false): unknown;
export function parseConfigValue(key: ConfigKey, type: 'json', defaultValue: unknown, isOptional: true): unknown | null;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This is difficult to split up
export function parseConfigValue(
	key: ConfigKey,
	type: 'string' | 'number' | 'json' | 'bool',
	defaultValue: unknown,
	isOptional: boolean = true,
) {
	const envKey = `EVERYTHING_${key.toUpperCase()}`;

	// First, check the database to see if the value exists
	let value = getConfigValue(key);

	// If not, check if it's in the .env file, and if so, set it in the database
	if (value === undefined) {
		value = process.env[envKey];

		if (value !== undefined && value !== '') {
			setConfigValue(key, value);
		}
	}

	// Otherwise, the value hasn't been set anywhere, so use a default value.
	if (value === undefined || value === '') {
		const shouldStringify = !(typeof defaultValue === 'string' || defaultValue === null);
		setConfigValue(key, shouldStringify ? JSON.stringify(defaultValue) : defaultValue);

		if (!isOptional) {
			if (defaultValue !== null) {
				return defaultValue;
			}
			throw new Error(
				`Required config value has not been set. Set config value '${key}' in the database, or '${envKey}' in the .env file`,
			);
		}
		return null;
	}

	if (value === null) return null;

	switch (type) {
		case 'number':
			return Number(value);
		case 'json':
			return JSON.parse(value);
		case 'bool':
			return value === 'true';
		default:
			return value;
	}
}

/**
 * Attempts to read an interval setting from the .env file, and converts it to
 * the cron format (eg. `* * * * *`).
 *
 * Very similar to {@link parseConfigValue}, but with fixed types and extra logic.
 */
export function parseIntervalToCron(key: ConfigKey, envKey: string, unit: 'h' | 'm' | 's' | 'ms'): string | null {
	const databaseValue = getConfigValue(key);

	if (databaseValue !== undefined) {
		return databaseValue;
	}

	const envValue = process.env[envKey];
	const envValueNumber = Number(envValue);

	// The value might be explicitly set to 0, in which case it's disabled
	if (envValue === undefined || envValueNumber === 0 || Number.isNaN(envValueNumber)) {
		setConfigValue(key, null);
		return null;
	}

	const intervalMinutes = convertUnitToMinutes(envValueNumber, unit);
	const cronFormat = convertPollIntervalToCron(intervalMinutes);
	setConfigValue(key, cronFormat);
	return cronFormat;
}
