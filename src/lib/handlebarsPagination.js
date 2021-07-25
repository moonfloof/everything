import { RECORDS_PER_PAGE } from '../database/constants.js';

const handlebarsPagination = (page, recordCount) => {
	const pageNumber = Number(page) || 0;
	const totalPages = Math.ceil(recordCount / RECORDS_PER_PAGE) - 1;

	return {
		page: pageNumber,
		totalPages,

		showPrev: pageNumber > 0,
		showNext: pageNumber < totalPages,

		prevPage: pageNumber - 1,
		nextPage: pageNumber + 1,
	};
};

export default handlebarsPagination;
