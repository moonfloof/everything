import { timeago } from '../adapters/timeago.js';
import { config } from '../lib/config/index.js';
import { dayMs, prettyDateTime } from '../lib/formatDate.js';

export interface Parameters {
	id?: string;
	limit?: number;
	days?: number;
	page?: number | string;
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
}: Parameters = {}): PaginationParameters {
	return {
		id,
		limit,
		offset: calculateOffset(page),
		created_at: calculateCreatedAt(days),
	};
}

// We don't care what types it has, other than `id` and the createdKey specified
// by the function, therefore `any` is appropriate here.
// biome-ignore lint/suspicious/noExplicitAny: See above.
export function calculateRecordMetadata<T extends Record<string, any> & { id: string }>(
	record: T,
	path: string | null,
	createdKey: keyof T = 'created_at',
) {
	const createdDate = new Date(record[createdKey]);
	return {
		canonicalUrl: path ? `${config.serverExternalUri}/${path}/${record.id}` : null,
		timeago: timeago.format(createdDate),
		timestampIso: createdDate.toISOString(),
		timestampPretty: prettyDateTime(createdDate),
	};
}
