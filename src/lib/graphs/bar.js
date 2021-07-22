const graphWidth = 640;
const graphHeight = 180;
const yAxisWidth = 24;
const pointLimit = 14;
const padding = 12;

const pointWidth = (graphWidth - yAxisWidth) / pointLimit;
const barHeight = graphHeight - padding;

function generateBar (y, max, index, label) {
	const height = Math.round((y / max) * barHeight);
	const width = pointWidth - padding;
	const posX = (index * pointWidth) + (padding / 2) + yAxisWidth;
	const posY = barHeight - height + (padding / 2);

	return `
		<rect
			x="${posX}" y="${padding / 2}" rx="8" ry="8"
			width="${width}" height="${barHeight}"
			style="opacity:0.1;"
		/>
		<rect
			x="${posX}" y="${posY}" rx="8" ry="8"
			width="${width}" height="${height}"
			style="fill:#2d1c88"
		/>
	`;
}

function generateText (x, y, text, align = 'start', transform = '') {
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
 * @param {Object[]} points
 * @param {number}   points[].y
 * @param {string}   points[].label
 * @export
 */
export function generateBarGraph (points, yLegend) {
	let max = points.reduce((acc, cur) => {
		return cur.y > acc
			? cur.y
			: acc;
	}, -99999);

	max = Math.ceil(max);

	const formattedPoints = points
		.reverse()
		.slice(-pointLimit)
		.map((p, index) => generateBar(p.y, max, index, p.label))
		.join('');

	const legendX = -(barHeight / 2);
	const legendY = padding / 2;

	return `
		<svg width="${graphWidth}" height="${graphHeight}" viewBox="0 0 ${graphWidth} ${graphHeight}">
			${generateText(yAxisWidth, legendY + 16, max, 'end')}
			${generateText(yAxisWidth, legendY + barHeight, '0', 'end')}
			${generateText(legendX - legendY, legendY + 12, yLegend || '', 'middle', 'rotate(-90)')}
			${formattedPoints}
		</svg>
	`;
}
