import { MAX_PAGE, RECORDS_PER_PAGE } from '../database/constants.js';

/**
 * @param {number} page
 * @param {number} recordCount
 */
const handlebarsPagination = (page, recordCount) => {
	const totalPages = Math.min(Math.ceil(recordCount / RECORDS_PER_PAGE) - 1, MAX_PAGE);

	return {
		page: page,
		totalPages,

		showPrev: page > 0,
		showNext: page < totalPages,

		prevPage: page - 1,
		nextPage: page + 1,
	};
};

export default handlebarsPagination;
