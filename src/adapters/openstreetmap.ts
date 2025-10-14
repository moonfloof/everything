import { XMLParser } from 'fast-xml-parser';
import phin from 'phin';
import type { CheckinImage } from '../database/checkins.js';
import { config } from '../lib/config.js';
import type { BoundingBox, Filter, FilteredPath, OsmXml, Point, SvgOptions, Way } from './openstreetmapTypes.js';
import { simplify } from './simplify.js';

// #region Calculate Bounding Box
// Based on: https://stackoverflow.com/a/238558

function deg2rad(degrees: number): number {
	return (Math.PI * degrees) / 180;
}

function rad2deg(radians: number): number {
	return (180 * radians) / Math.PI;
}

function WGS84EarthRadius(lat: number): number {
	const WGS84_a = 6378137.0; // Major semiaxis [m]
	const WGS84_b = 6356752.3; // Minor semiaxis [m]
	const An = WGS84_a * WGS84_a * Math.cos(lat);
	const Bn = WGS84_b * WGS84_b * Math.sin(lat);
	const Ad = WGS84_a * Math.cos(lat);
	const Bd = WGS84_b * Math.sin(lat);

	return Math.sqrt((An * An + Bn * Bn) / (Ad * Ad + Bd * Bd));
}

function haversine(a: Point, b: Point) {
	const aLat = deg2rad(a[1]);
	const aLon = deg2rad(a[0]);
	const bLat = deg2rad(b[1]);
	const bLon = deg2rad(b[0]);
	const R = 6371000;

	return R * Math.acos(Math.cos(aLat) * Math.cos(bLat) * Math.cos(bLon - aLon) + Math.sin(aLat) * Math.sin(bLat));
}

export function generateBoundingBox(options: SvgOptions): BoundingBox {
	const { checkin, pointsOfInterest } = options;

	// aspect ratio of 2:1
	let halfSideLatMetres = 300;
	let halfSideLonMetres = 600;

	let lon = deg2rad(checkin[0]); // X
	let lat = deg2rad(checkin[1]); // Y

	// TODO: Exclude POIs whose distance is unusually far away from the others
	if (pointsOfInterest !== undefined && pointsOfInterest.length > 0) {
		const longitudes = pointsOfInterest.map(poi => poi[0]);
		const latitudes = pointsOfInterest.map(poi => poi[1]);
		longitudes.push(checkin[0]);
		latitudes.push(checkin[1]);

		const xMin = Math.min(...longitudes);
		const xMax = Math.max(...longitudes);
		const yMin = Math.min(...latitudes);
		const yMax = Math.max(...latitudes);

		// Longitudinal distance
		const xRad = haversine([xMin, yMin], [xMax, yMin]) / 2;

		// Latitudinal distance
		const yRad = haversine([xMin, yMin], [xMin, yMax]) / 2;

		// Get mid-point of bounding box
		lon = deg2rad((xMin + xMax) / 2);
		lat = deg2rad((yMin + yMax) / 2);

		// Make sure the bounding coordinates are 2:1 (with a little extra padding)
		halfSideLonMetres = Math.max(halfSideLonMetres, xRad > yRad * 2 ? xRad : yRad * 2) * 1.25;
		halfSideLatMetres = Math.max(halfSideLatMetres, xRad > yRad * 2 ? xRad / 2 : yRad) * 1.25;
	}

	// Radius of Earth at given latitude
	const radius = WGS84EarthRadius(lat);
	const parallelRadius = radius * Math.cos(lat);

	return {
		// All coords rounded to 6 d.p.
		lat_min: Math.round(rad2deg(lat - halfSideLatMetres / radius) * 1000000) / 1000000,
		lat_max: Math.round(rad2deg(lat + halfSideLatMetres / radius) * 1000000) / 1000000,
		long_min: Math.round(rad2deg(lon - halfSideLonMetres / parallelRadius) * 1000000) / 1000000,
		long_max: Math.round(rad2deg(lon + halfSideLonMetres / parallelRadius) * 1000000) / 1000000,
	};
}

// #endregion

function formatBoundingBox(bbox: BoundingBox): string {
	return `${bbox.long_min},${bbox.lat_min},${bbox.long_max},${bbox.lat_max}`;
}

function parseBoundingBoxFromSvg(svg: string): BoundingBox | null {
	const match = svg.match(
		/data-boundingbox="(?<long_min>-?[0-9.]+),(?<lat_min>-?[0-9.]+),(?<long_max>-?[0-9.]+),(?<lat_max>-?[0-9.]+)"/,
	);
	if (match === null || match.groups === undefined) {
		return null;
	}

	const { long_min, lat_min, long_max, lat_max } = match.groups;

	return {
		long_min: Number.parseFloat(long_min),
		lat_max: Number.parseFloat(lat_max),
		lat_min: Number.parseFloat(lat_min),
		long_max: Number.parseFloat(long_max),
	};
}

export function getPhotoPositions(svg: string, photos: Pick<CheckinImage, 'id' | 'lat' | 'long'>[]) {
	const bbox = parseBoundingBoxFromSvg(svg);
	if (bbox === null) return [];
	const getXY = createGetXY(bbox, 100, 100);
	return photos.reduce(
		(mapped, { id, lat, long }) => {
			if (long === null || lat === null) {
				return mapped;
			}
			const [left, top] = getXY([long, lat]);
			mapped.push({ id, left, top });
			return mapped;
		},
		[] as { id: string; top: number; left: number }[],
	);
}

async function downloadOsm(bbox: BoundingBox): Promise<string> {
	const param = `?bbox=${formatBoundingBox(bbox)}`;
	const response = await phin({
		url: config.location.osmBaseUrl + param,
		method: 'GET',
		headers: {
			'User-Agent': config.versionString,
		},
	});
	return response.body.toString();
}

function parseOsm(osm: string): Way[] {
	const xml: OsmXml = new XMLParser({
		ignoreAttributes: false,
		attributeNamePrefix: '',
		allowBooleanAttributes: true,
		parseAttributeValue: true,
		isArray(tagName) {
			if (['nd', 'tag'].includes(tagName)) return true;
			return false;
		},
	}).parse(osm);

	return xml.osm.way
		.filter(way => way.nd.length > 1)
		.map(way => {
			const tag =
				way.tag?.reduce(
					(acc, cur) => {
						acc[cur.k] = cur.v;
						return acc;
					},
					{} as Record<string, string | number>,
				) ?? {};

			const path: [number, number][] = way.nd.map(nd => {
				const realNode = xml.osm.node.find(node => node.id === nd.ref);
				if (realNode === undefined) {
					throw new Error("Whoops, weren't expecting to find a non-existent node!");
				}
				return [realNode.lon, realNode.lat];
			});

			return {
				path,
				tag,
			};
		});
}

function filterPaths(ways: Way[], filters: Filter[]): FilteredPath[] {
	return Object.values(
		ways.reduce(
			(paths, way): Record<number, FilteredPath> => {
				const matchIndex = filters.findIndex(filter => {
					const tagValue = way.tag[filter.tag];
					if (tagValue === undefined) return false;
					if (filter.values === undefined) return true;
					return filter.values.includes(`${tagValue}`);
				});

				if (matchIndex === -1) return paths;

				if (!paths[matchIndex]) {
					paths[matchIndex] = {
						paths: [way.path],
						styleCss: filters[matchIndex]?.styleCss,
					};
					return paths;
				}

				paths[matchIndex].paths.push(way.path);

				return paths;
			},
			{} as Record<number, FilteredPath>,
		),
	);
}

function generateCrosshair(x: number, y: number): string {
	const xleft = Math.round(x - 4);
	const xright = Math.round(x + 4);
	const ytop = Math.round(y - 4);
	const ybottom = Math.round(y + 4);

	const line1 = `<line x1="${xleft}" x2="${xright}" y1="${ytop}" y2="${ybottom}" />`;
	const line2 = `<line x1="${xleft}" x2="${xright}" y1="${ybottom}" y2="${ytop}" />`;

	return `\n<g class="map-crosshair">${line1}${line2}</g>`;
}

function createGetXY(bbox: BoundingBox, width: number, height: number) {
	/** Gets the ratio of each value between the min and max, and extrapolates */
	return function getXY([x, y]: [number, number]): [number, number] {
		return [
			((x - bbox.long_min) / (bbox.long_max - bbox.long_min)) * width,
			((y - bbox.lat_max) / (bbox.lat_min - bbox.lat_max)) * height,
		];
	};
}

export async function generateSvg(options: SvgOptions) {
	const bbox = generateBoundingBox(options);
	const osm = await downloadOsm(bbox);
	const ways = parseOsm(osm);
	const filteredPaths = filterPaths(ways, [
		{
			tag: 'highway',
			values: ['primary', 'motorway'],
			styleCss: 'stroke-width: 8px;',
		},
		{
			tag: 'highway',
			values: ['secondary', 'tertiary', 'trunk'],
			styleCss: 'stroke-width: 6px;',
		},
		{
			tag: 'highway',
			values: ['residential', 'unclassified', 'trunk_link', 'service'],
			styleCss: 'stroke-width: 3px;',
		},
		{
			tag: 'highway',
			values: ['path', 'footway', 'track', 'pedestrian'],
			styleCss: 'stroke-width: 2.5px;stroke-dasharray: 4,3;',
		},
		{
			tag: 'natural',
			values: ['cliff', 'coastline', 'water'],
			styleCss: 'stroke-width: 2px;',
		},
		{
			tag: 'natural',
			values: ['wood'],
			styleCss: 'stroke-width: 1.5px; opacity: 0.5',
		},
		{
			tag: 'landuse',
			values: ['farmland'],
			styleCss: 'stroke-width: 2px;',
		},
		{
			tag: 'building',
			styleCss: 'stroke-width: 2px; opacity: 0.5;',
		},
	]);

	const cWidth = 800;
	const cHeight = 400;

	const getXY = createGetXY(bbox, cWidth, cHeight);

	function generatePath(poly: [number, number][]): string {
		// Remove all points waaaay outside the bounding box
		// (with some padding though!)
		const points = simplify(poly, 0.00003, true).filter(
			poly =>
				poly[0] >= bbox.long_min - 0.01 &&
				poly[0] <= bbox.long_max + 0.01 &&
				poly[1] >= bbox.lat_min - 0.01 &&
				poly[1] <= bbox.lat_max + 0.01,
		);
		const [firstPoint, ...rest] = points;
		if (firstPoint === undefined) return '';

		const [fx, fy] = getXY(firstPoint);
		const commands: string[] = [`M${Math.round(fx)} ${Math.round(fy)}`];

		let lastXY: [number, number] = [fx, fy];
		for (const point of rest) {
			const [x, y] = getXY(point);
			if (Math.abs(lastXY[0] - x) < 1 && Math.abs(lastXY[1] - y) < 1) continue;
			commands.push(`L${Math.round(x)} ${Math.round(y)}`);
			lastXY = [x, y];
		}

		if (commands.length < 2) return '';
		return commands.join('');
	}

	// Convert all filtered paths into actual SVG paths
	const svgPaths = filteredPaths
		.map(({ paths, styleCss }) => {
			const style = styleCss ?? 'stroke-width: 1.5px;';
			const d = paths.map(generatePath).join('');
			return `<path style="${style}" d="${d}"/>`;
		})
		.join('\n\t');

	// Generate a marker on the SVG to denote the check-in location
	const svgCrosshair =
		options?.checkin !== undefined
			? generateCrosshair(...getXY(options.checkin))
			: generateCrosshair(cWidth / 2, cHeight / 2);

	const svgHeader = `<svg viewBox="0 0 ${cWidth} ${cHeight}" data-boundingbox="${formatBoundingBox(bbox)}" version="1.1" xmlns="http://www.w3.org/2000/svg">`;
	const svgFooter = '\n</svg>';

	return svgHeader + svgPaths + svgCrosshair + svgFooter;
}
