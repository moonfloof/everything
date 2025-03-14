export interface BoundingBox {
	lat_min: number;
	lat_max: number;
	long_min: number;
	long_max: number;
}

export interface OsmNode {
	id: number;
	visible: boolean;
	version: number;
	changeset: number;
	timestamp: string;
	user: string;
	uid: number;
	lat: number;
	lon: number;
}

export interface OsmWayNode {
	ref: OsmNode['id'];
}

export interface OsmWayTag {
	k: string;
	v: string;
}

export interface OsmWay {
	id: number;
	visible: true;
	version: number;
	changeset: number;
	timestamp: string;
	user: string;
	uid: number;
	nd: OsmWayNode[];
	tag?: OsmWayTag[];
}

export interface OsmXml {
	osm: {
		node: OsmNode[];
		way: OsmWay[];
		relation: unknown[];
	};
}

export interface Way {
	tag: Record<string, string | number>;
	path: [number, number][];
}

export interface Filter {
	tag: string;
	values?: string[];
	styleCss?: string;
}

export interface FilteredPath {
	paths: [number, number][][];
	styleCss?: string;
}
