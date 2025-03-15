import { XMLParser } from 'fast-xml-parser';
import phin from 'phin';
import { config } from '../lib/config.js';
import { simplify } from './simplify.js';
import type { BoundingBox, Filter, FilteredPath, OsmXml, Way } from './openstreetmapTypes.js';

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

export function generateBoundingBox(latDeg: number, longDeg: number): BoundingBox {
	const lat = deg2rad(latDeg); // Y
	const lon = deg2rad(longDeg); // X

	// aspect ratio of 2:1
	const halfSideLatMetres = 400;
	const halfSideLonMetres = 800;

	// Radius of Earth at given latitude
	const radius = WGS84EarthRadius(lat);
	const parallelRadius = radius * Math.cos(lat);

	return {
		lat_min: Math.round(rad2deg(lat - halfSideLatMetres / radius) * 1000000) / 1000000,
		lat_max: Math.round(rad2deg(lat + halfSideLatMetres / radius) * 1000000) / 1000000,
		long_min: Math.round(rad2deg(lon - halfSideLonMetres / parallelRadius) * 1000000) / 1000000,
		long_max: Math.round(rad2deg(lon + halfSideLonMetres / parallelRadius) * 1000000) / 1000000,
	};
}

// #endregion

async function downloadOsm(bbox: BoundingBox): Promise<string> {
	const param = `?bbox=${bbox.long_min},${bbox.lat_min},${bbox.long_max},${bbox.lat_max}`;
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

export async function generateSvg(bbox: BoundingBox) {
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
			styleCss: 'stroke-width: 2.5px;',
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

	function generatePath(poly: [number, number][]): string {
		const [firstPoint, ...rest] = simplify(poly, 0.00003, true);
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

	/** Gets the ratio of each value between the min and max, and extrapolates */
	function getXY([x, y]: [number, number]): [number, number] {
		return [
			((x - bbox.long_min) / (bbox.long_max - bbox.long_min)) * cWidth,
			((y - bbox.lat_max) / (bbox.lat_min - bbox.lat_max)) * cHeight,
		];
	}

	const svgPaths = filteredPaths
		.map(({ paths, styleCss }) => {
			return `<path style="${styleCss ?? 'stroke-width: 1.5px;'}" d="${paths.map(generatePath).join('')}"/>`;
		})
		.join('\n\t');

	const svgHeader = `<svg viewBox="0 0 ${cWidth} ${cHeight}" version="1.1" xmlns="http://www.w3.org/2000/svg">`;
	const svgFooter = '</svg>';

	return svgHeader + svgPaths + svgFooter;
}
