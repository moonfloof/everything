const graphWidth = 80;
const graphHeight = 80;
const barWidth = 7;
const barSpacing = 1;
const pointLimit = 10;

/**
 * @typedef {object} Bar
 * @property {number} min
 * @property {number} max
 */

/**
 * @param {Bar} point
 * @param {number} min
 * @param {number} max
 * @param {number} index
 * @return {string}
 */
function generateBar (point, min, max, index) {
	const posX = index * (barWidth + barSpacing);
	const posY = Math.round(graphHeight - ((point.max / max) * graphHeight));
	const height = Math.round(graphHeight - posY - (((point.min - min) / max) * graphHeight));

	return `
		<rect
			x="${posX}" y="${posY}"
			width="${barWidth}" height="${height}"
			style="fill:#3e3475"
		/>
	`;
}

/**
 * @param {Bar[]} points
 * @param {number} [minOverride]
 * @param {number} [maxOverride]
 */
export function generateSmallBarGraph (points, minOverride, maxOverride) {
	const pointsTrunc = points.slice(0, pointLimit);
	const { min, max } = pointsTrunc.reduce((acc, cur) => {
		const newAcc = { ...acc };
		if (cur.min < acc.min) {
			newAcc.min = Math.floor(cur.min);
		}
		if (cur.max > acc.max) {
			newAcc.max = Math.ceil(cur.max);
		}

		return newAcc;
	}, { min: 99999, max: -99999 });

	const bars = pointsTrunc
		.reverse()
		.map((point, index) => generateBar(
			point,
			minOverride ?? min,
			maxOverride ?? max,
			index,
		))
		.join('');

	const zeroLine = Math.round(graphHeight
		- 1
		- (Math.abs(min) / Math.abs(max === 0 ? 1 : max))
		* graphHeight);

	return `
		<svg
			width="${graphWidth}" height="${graphHeight}"
			viewBox="0 0 ${graphWidth} ${graphHeight}"
		>
			${bars}
			<rect
				x="0"
				y="${zeroLine}"
				width="${graphWidth}"
				height="1"
				fill-opacity="0.8"
			/>
		</svg>
	`;
}
