const graphWidth = 640;
const graphHeight = 180;
const yAxisWidth = 32;
const xAxisWidth = 16;
const pointLimit = 14;
const padding = 12;
const boxRadius = 6;

const pointWidth = (graphWidth - yAxisWidth) / pointLimit;
const barHeight = graphHeight - padding - xAxisWidth;

function generateText(x, y, text, align = 'start', transform = '') {
	return `
		<text
			x="${x}"
			y="${y}"
			text-anchor="${align}"
			fill="black"
			transform="${transform}"
		>
			${text}
		</text>
	`;
}

/**
 * @param {number} y
 * @param {number} max
 * @param {number} index
 * @param {string} label
 * @return {string} SVG containing two rectangles and the X axis label
 */
function generateBar(y, max, index, label) {
	const height = Math.round((y / max) * barHeight);
	const width = pointWidth - padding;
	const posX = index * pointWidth + padding / 2 + yAxisWidth;
	const posY = barHeight - height + padding / 2;

	const textScale = 0.75;

	const text = generateText(
		posX / textScale + 16 / textScale,
		(barHeight + 24) / textScale,
		label,
		'middle',
		`scale(${textScale})`,
	);

	return `
		<rect
			x="${posX}" y="${padding / 2}" rx="${boxRadius}" ry="${boxRadius}"
			width="${width}" height="${barHeight}"
			style="opacity:0.1;"
		/>
		<rect
			x="${posX}" y="${posY}" rx="${boxRadius}" ry="${boxRadius}"
			width="${width}" height="${height}"
			style="fill:#3e3475"
		/>
		${text}
	`;
}

/**
 * @param {Object[]} points
 * @param {number}   points[].y
 * @param {string}   points[].label
 * @export
 */
export function generateBarGraph(points, yLegend) {
	let max = points.reduce((acc, cur) => {
		return cur.y > acc ? cur.y : acc;
	}, -99999);

	max = Math.ceil(max);

	const formattedPoints = points
		.reverse()
		.slice(-pointLimit)
		.map((p, index) => generateBar(p.y, max, index, p.label))
		.join('');

	const legendX = -(barHeight / 2);
	const legendY = padding / 2;

	const axisText = generateText(
		legendX - legendY,
		legendY + yAxisWidth - 8,
		yLegend || '',
		'middle',
		'rotate(-90)',
	);

	return `
		<svg width="100%" viewBox="0 0 ${graphWidth} ${graphHeight}">
			${generateText(yAxisWidth, legendY + 16, max, 'end')}
			${generateText(yAxisWidth, legendY + barHeight, '0', 'end')}
			${axisText}
			${formattedPoints}
		</svg>
	`;
}
