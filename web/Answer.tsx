import type { ReactNode } from 'react';
import { BOX, CHAR, NOTE, PAD, diagramLabel, layoutTree, parseAnswer, type Diagram, type Inline } from './markdown';

const inlines = (items: Inline[]): ReactNode[] => items.map((item, i) => {
	if (typeof item === 'string') return item;
	if (item.kind === 'code') return <code key={i}>{item.text}</code>;
	const Tag = item.kind;
	return <Tag key={i}>{inlines(item.children)}</Tag>;
});
const longest = (values: (string | number)[]) => Math.max(0, ...values.map(value => String(value).length));

function Figure({ d }: { d: Diagram }) {
	let width: number, height: number, body: ReactNode;
	if (d.type === 'tree') {
		const layout = layoutTree(d.root), box = layout.slot - 8;
		({ width, height } = layout);
		body = <>{layout.nodes.map(({ node, x, y, parent }, i) => parent && <line key={`e${i}`} className={node.hl ? 'edge hl' : 'edge'} x1={parent.x} y1={parent.y + BOX / 2 + (parent.node.note ? NOTE : 0)} x2={x} y2={y - BOX / 2} />)}
			{layout.nodes.map(({ node, x, y }, i) => <g key={i} className={[node.hl && 'hl', node.kind].filter(Boolean).join(' ') || undefined}><rect x={x - box / 2} y={y - BOX / 2} width={box} height={BOX} rx={6} /><text x={x} y={y}>{node.label}</text>{node.note && <text className="note" x={x} y={y + BOX / 2 + NOTE / 2 + 2}>{node.note}</text>}</g>)}</>;
	} else if (d.type === 'array') {
		const pointers = Object.entries(d.pointers ?? {}), cw = Math.max(36, CHAR * Math.max(longest(d.cells), ...pointers.map(([name]) => name.length + 1)) + 16), top = PAD + 16, stack: number[] = [];
		const rows = pointers.map(([, at]) => stack[at] = (stack[at] ?? -1) + 1), depth = rows.length && Math.max(...rows) + 1;
		width = 2 * PAD + Math.max(d.cells.length, ...pointers.map(([, at]) => at + 1)) * cw;
		height = top + 36 + PAD + (depth && depth * 16 + 6);
		body = <>{d.cells.map((value, i) => <g key={i} className={d.hl?.includes(i) ? 'hl' : undefined}><text className="index" x={PAD + i * cw + cw / 2} y={PAD + 6}>{i}</text><rect x={PAD + i * cw} y={top} width={cw} height={36} /><text x={PAD + i * cw + cw / 2} y={top + 18}>{value}</text></g>)}
			{pointers.map(([name, at], i) => <text key={name} className="pointer" x={PAD + at * cw + cw / 2} y={top + 50 + rows[i] * 16}>{`↑${name}`}</text>)}</>;
	} else {
		const cs = Math.max(32, CHAR * longest([...d.cells.flat(), ...d.cols ?? []]) + 12), hw = d.rows ? Math.max(28, CHAR * longest(d.rows) + 12) : 0, hh = d.cols ? 24 : 0;
		width = 2 * PAD + hw + d.cells[0].length * cs; height = 2 * PAD + hh + d.cells.length * cs;
		body = <>{d.rows?.map((label, r) => <text key={`r${r}`} className="index" x={PAD + hw / 2} y={PAD + hh + r * cs + cs / 2}>{label}</text>)}
			{d.cols?.map((label, c) => <text key={`c${c}`} className="index" x={PAD + hw + c * cs + cs / 2} y={PAD + hh / 2}>{label}</text>)}
			{d.cells.map((row, r) => row.map((value, c) => <g key={`${r},${c}`} className={d.hl?.some(([hr, hc]) => hr === r && hc === c) ? 'hl' : undefined}><rect x={PAD + hw + c * cs} y={PAD + hh + r * cs} width={cs} height={cs} /><text x={PAD + hw + c * cs + cs / 2} y={PAD + hh + r * cs + cs / 2}>{value}</text></g>))}</>;
	}
	return <figure>{d.title && <figcaption>{d.title}</figcaption>}<div className="diagram"><svg role="img" aria-label={diagramLabel(d)} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>{body}</svg></div></figure>;
}

export function Answer({ text, streaming, highlight }: { text: string; streaming: boolean; highlight?: (text: string) => void }) {
	return <div className="answer">{parseAnswer(text).map((block, i) => block.kind === 'p' ? <p key={i}>{inlines(block.children)}</p>
		: block.kind === 'ul' ? <ul key={i}>{block.items.map((item, j) => <li key={j}>{inlines(item)}</li>)}</ul>
		: block.kind === 'ol' ? <ol key={i} start={block.start}>{block.items.map((item, j) => <li key={j}>{inlines(item)}</li>)}</ol>
		: block.kind === 'diagram' ? <Figure key={i} d={block.diagram} />
		: block.kind === 'quote' ? <blockquote key={i}><p>{block.text}</p>{highlight && <button type="button" onClick={() => highlight(block.text)}>Show in the lesson</button>}</blockquote>
		: block.lang === 'diagram' && block.open && streaming ? <p key={i}>Drawing a diagram...</p>
		: <pre key={i}><code>{block.text}</code></pre>)}</div>;
}
