import { dayMs } from '../lib/formatDate.js';

export const RECORDS_PER_PAGE = 20;
export const MAX_PAGE = 20;
export const DEFAULT_DAYS = 10000;

/**
 * @param {number} page
 * @return {number}
 */
export function calculateOffset (page) {
	const pageNumber = Number(page);
	return Number.isNaN(pageNumber) ? 0 : pageNumber * RECORDS_PER_PAGE;
}

export function calculateCreatedAt (days) {
	return new Date(Date.now() - (days * dayMs)).toISOString();
}

export function calculateGetParameters ({ id = '%', limit = RECORDS_PER_PAGE, days = DEFAULT_DAYS, page = 0 } = {}) {
	return {
		id,
		limit,
		offset: calculateOffset(page),
		created_at: calculateCreatedAt(days),
	};
}
