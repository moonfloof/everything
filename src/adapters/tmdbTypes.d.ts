export type TmbdMovieDetails = {
	id: number;
	title: string;
	tagline: string;
	overview: string;
	status: string;
	runtime: number;
	genres: {
		id: number;
		name: string;
	}[];
	adult: boolean;
	backdrop_path: string;
	belongs_to_collection: null;
	budget: number;
	homepage: string;
	imdb_id: string;
	origin_country: string[];
	original_language: string;
	original_title: string;
	poster_path: string;
	release_date: string;
	revenue: number;
	production_companies: {
		id: number;
		logo_path: string;
		name: string;
		origin_country: string;
	}[];
	production_countries: {
		iso_3166_1: string;
		name: string;
	}[];
	spoken_languages: {
		english_name: string;
		iso_639_1: string;
		name: string;
	}[];
	video: boolean;
	popularity: number;
	vote_average: number;
	vote_count: number;
};

export type TmdbImage = {
	file_path: string;
	iso_639_1: string | null;

	vote_average: number;
	vote_count: number;

	aspect_ratio: number;
	width: number;
	height: number;
};

export type ImagesResponse = {
	id: number;
	backdrops: TmdbImage[];
	logos: TmdbImage[];
	posters: TmdbImage[];
};

export type SearchResponse = {
	page: number;
	results: {
		adult: boolean;
		backdrop_path: string;
		genre_ids: number[];
		id: number;
		original_language: string;
		original_title: string;
		overview: string;
		popularity: string;
		poster_path: string;
		release_date: string;
		title: string;
		video: boolean;
		vote_average: number;
		vote_count: number;
	}[];
	total_pages: number;
	total_results: number;
};
