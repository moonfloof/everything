export interface Episode {
	id: number;
	seasonNumber: number;
	episodeNumber: number;
	title: string;
	runtime: number;
}

export interface Series {
	id: number;
	title: string;
	year: number;
}

export type EpisodeWithSeries = Episode & {
	series: Series;
};
