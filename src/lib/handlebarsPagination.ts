import { MAX_PAGE, RECORDS_PER_PAGE } from '../database/constants.js';

const handlebarsPagination = (page: number | string, recordCount: number) => {
	const totalPages = Math.min(Math.ceil(recordCount / RECORDS_PER_PAGE) - 1, MAX_PAGE);

	return {
		page: Number(page),
		totalPages,

		showPrev: Number(page) > 0,
		showNext: Number(page) < totalPages,

		prevPage: Number(page) - 1,
		nextPage: Number(page) + 1,
	};
};

export default handlebarsPagination;
