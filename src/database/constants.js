export const RECORDS_PER_PAGE = 20;
export const MAX_PAGE = 20;

/**
 * @param {number} page
 * @return {number}
 */
export function calculateOffset (page) {
	const pageNumber = Number(page);
	return Number.isNaN(pageNumber) ? 0 : pageNumber * RECORDS_PER_PAGE;
}
