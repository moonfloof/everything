import type { Optional } from '../types/database.js';

export function validateSafeNumber(input: unknown): Optional<number> {
	if (input === undefined || input === '') return null;

	const num = Number(input);
	if (Number.isNaN(num) || !Number.isSafeInteger(num)) {
		throw new Error('Input number must be an integer');
	}

	return num;
}
