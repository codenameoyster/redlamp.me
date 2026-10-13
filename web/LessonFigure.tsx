import { useState } from 'react';
import type { Figure } from '../shared/leetcode';

// SVG units. CELL is the cell height and the smallest cell width. CHAR is the width of one character of the 14px monospace font.
const CELL = 36, GAP = 10, LINE = 16, BRACKET = 10, CHAR = 8.5;
const textWidth = (value: number | string) => String(value).length * CHAR;

// Draws one lesson figure. All frames use one size, so the picture stays in place between steps.
export function LessonFigure({ figure }: { figure: Figure }) {
	const [step, setStep] = useState(0), frame = figure.frames[step], last = figure.frames.length - 1;
	const all = figure.frames.flatMap(item => item.rows), count = Math.max(...figure.frames.map(item => item.rows.length));
	const label = Math.max(0, ...all.map(row => row.label ? textWidth(row.label) + GAP : 0));
	const cell = Math.max(CELL, ...all.flatMap(row => row.cells.map(value => textWidth(value) + GAP)));
	// Each pointer name has its own line under row k, so two names never overlap.
	const names = (k: number) => [...new Set(figure.frames.flatMap(item => Object.keys(item.rows[k]?.pointers ?? {})))];
	const bracket = (k: number) => figure.frames.some(item => item.rows[k]?.window) ? BRACKET : 0;
	const top = [0];
	for (let k = 0; k < count; k++) top.push(top[k] + CELL + bracket(k) + names(k).length * LINE + GAP);
	const width = Math.max(...all.flatMap(row => [label + row.cells.length * cell, ...Object.entries(row.pointers ?? {}).map(([name, i]) => label + (i + 0.5) * cell + textWidth(`↑ ${name}`))]));
	const height = top[count] - GAP;
	return <>
		<figcaption>{figure.title}</figcaption>
		<svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={frame.caption}>
			{frame.rows.map((row, k) => <g key={k} transform={`translate(0 ${top[k]})`}>
				{row.label && <text className="figure-label" y={CELL / 2}>{row.label}</text>}
				{row.cells.map((value, i) => <g key={i} className={row.marked?.includes(i) ? 'figure-mark' : row.dimmed?.includes(i) ? 'figure-dim' : undefined}>
					<rect x={label + i * cell} width={cell} height={CELL} />
					<text x={label + (i + 0.5) * cell} y={CELL / 2}>{value}</text>
				</g>)}
				{row.window && <path className="figure-window" d={`M${label + row.window[0] * cell + 3} ${CELL + 2}v6H${label + (row.window[1] + 1) * cell - 3}v-6`} />}
				{Object.entries(row.pointers ?? {}).map(([name, i]) => <text key={name} className="figure-pointer" x={label + (i + 0.5) * cell - CHAR / 2} y={CELL + bracket(k) + (names(k).indexOf(name) + 1) * LINE - 3}>↑ {name}</text>)}
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
