interface ApiResponse<T> {
	success: boolean;
	data: T[];
}

interface ApiPagedResponse<T> {
	success: boolean;
	page: number;
	total: number;
	limit: number;
	data: T[];
}

export type SearchAutocompleteResponse = ApiResponse<{
	id: number;
	name: string;
	types: string[];
	verified: boolean;
}>;

type TrueFalseAny = 'true' | 'false' | 'any';

type ImageQuery = Partial<{
	styles: 'alternative' | 'blurred' | 'material';
	mimes: 'image/png' | 'image/jpeg' | 'image/webp';
	types: 'static' | 'animated';
	nsfw: TrueFalseAny;
	humor: TrueFalseAny;
	epilepsy: TrueFalseAny;
	oneoftag: string;
	limit: number;
	page: number;
}>;

export type HeroesQuery = ImageQuery & {
	dimensions: '1920x620' | '3840x1240' | '1600x650';
};

export type GridsQuery = ImageQuery & {
	dimensions: '460x215' | '920x430' | '600x900' | '342x482' | '660x930' | '512x512' | '1024x1024';
};

export type ImageResponse = ApiPagedResponse<{
	id: number;
	score: number;
	style: 'alternative' | 'blurred' | 'white_logo' | 'material' | 'no_logo';
	url: string;
	thumb: string;
	tags: string[];
	author: {
		name: string;
		steam64: string;
		avatar: string;
	};
}>;
