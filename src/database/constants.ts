import { dayMs } from '../lib/formatDate.js';

export interface Parameters {
	id: string;
	limit: number;
	days: number;
	page: number | string;
}

export interface PaginationParameters {
	id: string;
	limit: number;
	offset: number;
	created_at: string;
}

export const RECORDS_PER_PAGE = 20;
export const MAX_PAGE = 20;
export const DEFAULT_DAYS = 10000;

export function calculateOffset(page: number | string) {
	const pageNumber = Number(page);
	return Number.isNaN(pageNumber) ? 0 : pageNumber * RECORDS_PER_PAGE;
}

export function calculateCreatedAt(days: number) {
	return new Date(Date.now() - days * dayMs).toISOString();
}

export function calculateGetParameters({
	id = '%',
	limit = RECORDS_PER_PAGE,
	days = DEFAULT_DAYS,
	page = 0,
}: Partial<Parameters> = {}): PaginationParameters {
	return {
		id,
		limit,
		offset: calculateOffset(page),
		created_at: calculateCreatedAt(days),
	};
}
