const graphWidth = 80;
const graphHeight = 80;
const barWidth = 7;
const barSpacing = 1;
const pointLimit = 10;

type Bar = {
	min: number;
	max: number;
};

function generateBar(point: Bar, min: number, max: number, index: number) {
	const posX = index * (barWidth + barSpacing);
	const posY = Math.round(graphHeight - (point.max / max) * graphHeight);
	const height = Math.round(graphHeight - posY - ((point.min - min) / max) * graphHeight);

	return `
		<rect
			x="${posX}" y="${posY}"
			width="${barWidth}" height="${height}"
			style="fill:#3e3475"
		/>
	`;
}

export function generateSmallBarRectangles(points: Bar[], minOverride?: number, maxOverride?: number) {
	const pointsTrunc = points.slice(0, pointLimit);
	const { min, max } = pointsTrunc.reduce(
		(acc, cur) => {
			if (cur.min < acc.min) {
				acc.min = Math.floor(cur.min);
			}
			if (cur.max > acc.max) {
				acc.max = Math.ceil(cur.max);
			}

			return acc;
		},
		{ min: 99999, max: -99999 },
	);

	const bars = pointsTrunc
		.reverse()
		.map((point, index) => generateBar(point, minOverride ?? min, maxOverride ?? max, index))
		.join('');

	const zeroLine = Math.round(graphHeight - 1 - (Math.abs(min) / Math.abs(max === 0 ? 1 : max)) * graphHeight);

	return `${bars}<rect
		x="0"
		y="${zeroLine}"
		width="${graphWidth}"
		height="1"
		fill-opacity="0.8"
	/>`;
}

export function generateSmallBarGraph(points: Bar[], minOverride?: number, maxOverride?: number) {
	return `<?xml version="1.0" ?>
		<svg
			width="${graphWidth}" height="${graphHeight}"
			viewBox="0 0 ${graphWidth} ${graphHeight}"
			version="1.1"
			xmlns="http://www.w3.org/2000/svg"
		>
			${generateSmallBarRectangles(points, minOverride, maxOverride)}
		</svg>
	`;
}
