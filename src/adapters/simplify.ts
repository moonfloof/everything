/*
 Simplify.js, a high-performance JS polyline simplification library
 mourner.github.io/simplify-js

 Copyright (c) 2017, Vladimir Agafonkin
 All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:

 1. Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.

 2. Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation
    and/or other materials provided with the distribution.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

 -----

 Modification by moonfloof in 2025, to add types to functions and accept
 [number, number][] as an input.
*/

import type { Point } from './openstreetmapTypes.js';

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
