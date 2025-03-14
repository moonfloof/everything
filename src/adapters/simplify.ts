/*
 (c) 2017, Vladimir Agafonkin
 Simplify.js, a high-performance JS polyline simplification library
 mourner.github.io/simplify-js

 Modification by moonfloof in 2025, to add types to functions and accept
 [number, number][] as an input.
*/

type Point = [number, number];

// to suit your point format, run search/replace for '.x' and '.y';
// for 3D version, see 3d branch (configurability would draw significant performance overhead)

// square distance between 2 points
function getSqDist(p1: Point, p2: Point) {
	const dx = p1[0] - p2[0];
	const dy = p1[1] - p2[1];

	return dx * dx + dy * dy;
}

// square distance from a point to a segment
function getSqSegDist(p: Point, p1: Point, p2: Point) {
	let x = p1[0];
	let y = p1[1];
	let dx = p2[0] - x;
	let dy = p2[1] - y;

	if (dx !== 0 || dy !== 0) {
		const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);

		if (t > 1) {
			x = p2[0];
			y = p2[1];
		} else if (t > 0) {
			x += dx * t;
			y += dy * t;
		}
	}

	dx = p[0] - x;
	dy = p[1] - y;

	return dx * dx + dy * dy;
}
// rest of the code doesn't care about point format

// basic distance-based simplification
function simplifyRadialDist(points: Point[], sqTolerance: number) {
	if (points[0] === undefined) return [];

	let prevPoint: Point = points[0];
	const newPoints = [prevPoint];
	let curPoint: Point = prevPoint;

	for (const point of points) {
		curPoint = point;
		if (getSqDist(point, prevPoint) > sqTolerance) {
			newPoints.push(point);
			prevPoint = point;
		}
	}

	if (prevPoint !== curPoint) newPoints.push(curPoint);

	return newPoints;
}

function simplifyDPStep(
	points: Point[],
	first: number,
	last: number,
	sqTolerance: number,
	simplified: Point[],
): Point[] {
	let maxSqDist = sqTolerance;
	let index = first;
	let output = [...simplified];

	if (points[first] === undefined || points[last] === undefined) {
		return output;
	}

	for (let i = first + 1; i < last; i++) {
		const point = points[i];
		if (point === undefined) return output;

		const sqDist = getSqSegDist(point, points[first], points[last]);

		if (sqDist > maxSqDist) {
			index = i;
			maxSqDist = sqDist;
		}
	}

	if (maxSqDist > sqTolerance) {
		if (index - first > 1) {
			output = simplifyDPStep(points, first, index, sqTolerance, output);
		}

		const point = points[index];
		if (point !== undefined) {
			output.push(point);
		}

		if (last - index > 1) {
			output = simplifyDPStep(points, index, last, sqTolerance, output);
		}
	}

	return output;
}

// simplification using Ramer-Douglas-Peucker algorithm
function simplifyDouglasPeucker(points: Point[], sqTolerance: number): Point[] {
	const last = points.length - 1;

	const simplified = simplifyDPStep(points, 0, last, sqTolerance, [points[0]!]);
	simplified.push(points[last]!);

	return simplified;
}

// both algorithms combined for awesome performance
export function simplify(points: Point[], tolerance?: number, highestQuality?: boolean) {
	if (points.length <= 2) return points;

	const sqTolerance = tolerance !== undefined ? tolerance * tolerance : 1;

	let output = highestQuality ? points : simplifyRadialDist(points, sqTolerance);
	output = simplifyDouglasPeucker(output, sqTolerance);

	return output;
}
