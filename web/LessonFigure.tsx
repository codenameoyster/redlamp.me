import { useState } from 'react';
import type { Figure, FigureRow } from '../shared/leetcode';

// SVG units. CELL is the cell height and the smallest cell width. CHAR is the width of one character of the 14px monospace font. LEVEL is the smallest height of one tree level, INDEX the line of the place numbers under a node.
const CELL = 36, GAP = 10, LINE = 16, BRACKET = 10, CHAR = 8.5, LEVEL = 56, INDEX = 12;
const textWidth = (value: number | string) => String(value).length * CHAR;
const tone = (row: FigureRow, i: number) => row.marked?.includes(i) ? 'figure-mark' : row.dimmed?.includes(i) ? 'figure-dim' : undefined;
// The type lets a frame leave a pointer name out, so only the names with an index draw.
const pointersOf = (row: FigureRow) => Object.entries(row.pointers ?? {}).filter((entry): entry is [string, number] => entry[1] !== undefined);

// A tree row in heapq order: the children of place i are places 2i + 1 and 2i + 2. An empty string is an empty place. A line runs from the border of the parent to the border of the child.
function Tree({ row, left, span, radius, rise }: { row: FigureRow; left: number; span: number; radius: number; rise: number }) {
	const at = (i: number) => { const level = Math.floor(Math.log2(i + 1)), slot = span / 2 ** level; return { x: left + (i + 1.5 - 2 ** level) * slot, y: level * rise + radius }; };
	const shown = (i: number) => row.cells[i] !== '';
	const edge = (i: number) => {
		const from = at((i - 1) >> 1), to = at(i), length = Math.hypot(to.x - from.x, to.y - from.y), ux = (to.x - from.x) / length, uy = (to.y - from.y) / length;
		return <line key={`edge-${i}`} className="figure-edge" x1={from.x + ux * radius} y1={from.y + uy * radius} x2={to.x - ux * radius} y2={to.y - uy * radius} />;
	};
	return <>
		{row.cells.map((_, i) => i > 0 && shown(i) && shown((i - 1) >> 1) && edge(i))}
		{row.cells.map((value, i) => shown(i) && <g key={i} className={tone(row, i)}>
			<circle cx={at(i).x} cy={at(i).y} r={radius} />
			<text x={at(i).x} y={at(i).y}>{value}</text>
			<text className="figure-index" x={at(i).x} y={at(i).y + radius + INDEX / 2}>{i}</text>
		</g>)}
	</>;
}

// Draws one lesson figure. All frames use one size, so the picture stays in place between steps.
export function LessonFigure({ figure }: { figure: Figure }) {
	const [step, setStep] = useState(0), frame = figure.frames[step], last = figure.frames.length - 1;
	const all = figure.frames.flatMap(item => item.rows), count = Math.max(...figure.frames.map(item => item.rows.length));
	const label = Math.max(0, ...all.map(row => row.label ? textWidth(row.label) + GAP : 0));
	const cell = Math.max(CELL, ...all.filter(row => !row.tree).flatMap(row => row.cells.map(value => textWidth(value) + GAP)));
	// A tree node is a circle wide enough for its longest value. A tree level is high enough to leave a visible part of the line between two circles. The deepest level of a tree row has 2^depth slots.
	const radius = Math.max(CELL / 2, ...all.filter(row => row.tree).flatMap(row => row.cells.map(value => textWidth(value) / 2 + 6))), slot = 2 * radius + 8;
	const rise = Math.max(LEVEL, 2 * radius + INDEX + 8);
	const tree = (k: number) => figure.frames.some(item => item.rows[k]?.tree);
	const depth = (k: number) => Math.max(0, ...figure.frames.map(item => item.rows[k]?.tree ? Math.floor(Math.log2(item.rows[k].cells.length)) : 0));
	// Each pointer name has its own line under row k, so two names never overlap.
	const names = (k: number) => [...new Set(figure.frames.flatMap(item => item.rows[k] ? pointersOf(item.rows[k]).map(([name]) => name) : []))];
	const bracket = (k: number) => figure.frames.some(item => item.rows[k]?.window) ? BRACKET : 0;
	const top = [0];
	for (let k = 0; k < count; k++) top.push(top[k] + (tree(k) ? depth(k) * rise + 2 * radius + INDEX : CELL + bracket(k) + names(k).length * LINE) + GAP);
	const width = Math.max(...Array.from({ length: count }, (_, k) => tree(k) ? label + 2 ** depth(k) * slot : 0), ...all.filter(row => !row.tree).flatMap(row => [label + row.cells.length * cell, ...pointersOf(row).map(([name, i]) => label + (i + 0.5) * cell + textWidth(`↑ ${name}`))]));
	const height = top[count] - GAP;
	return <>
		<figcaption>{figure.title}</figcaption>
		<svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={frame.caption}>
			{frame.rows.map((row, k) => <g key={k} transform={`translate(0 ${top[k]})`}>
				{row.label && <text className="figure-label" y={row.tree ? radius : CELL / 2}>{row.label}</text>}
				{row.tree ? <Tree row={row} left={label} span={2 ** depth(k) * slot} radius={radius} rise={rise} /> : <>
					{row.cells.map((value, i) => <g key={i} className={tone(row, i)}>
						<rect x={label + i * cell} width={cell} height={CELL} />
						<text x={label + (i + 0.5) * cell} y={CELL / 2}>{value}</text>
					</g>)}
					{row.window && <path className="figure-window" d={`M${label + row.window[0] * cell + 3} ${CELL + 2}v6H${label + (row.window[1] + 1) * cell - 3}v-6`} />}
					{pointersOf(row).map(([name, i]) => <text key={name} className="figure-pointer" x={label + (i + 0.5) * cell - CHAR / 2} y={CELL + bracket(k) + (names(k).indexOf(name) + 1) * LINE - 3}>↑ {name}</text>)}
				</>}
			</g>)}
		</svg>
		{last > 0 && <div className="row">
			{/* aria-disabled keeps the focus on the button at the first and the last frame. */}
			<button type="button" aria-disabled={step === 0} onClick={() => setStep(value => Math.max(value - 1, 0))} data-tip="Показать предыдущий шаг рисунка.">Назад</button>
			<span>Шаг {step + 1} из {last + 1}</span>
			<button type="button" aria-disabled={step === last} onClick={() => setStep(value => Math.min(value + 1, last))} data-tip="Показать следующий шаг рисунка.">Вперёд</button>
		</div>}
		<p aria-live="polite">{frame.caption}</p>
	</>;
}
