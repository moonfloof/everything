export const RECORDS_PER_PAGE = 20;

export function calculateOffset (page) {
	const pageNumber = Number(page);
	return Number.isNaN(pageNumber) ? 0 : page * RECORDS_PER_PAGE;
}
