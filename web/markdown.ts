export type Inline = string | { kind: 'code'; text: string } | { kind: 'strong' | 'em'; children: Inline[] };
export type TreeNode = { label: string; note?: string; hl?: boolean; kind?: 'answer' | 'pruned'; children?: TreeNode[] };
export type Diagram =
	| { type: 'tree'; title?: string; root: TreeNode }
	| { type: 'array'; title?: string; cells: (string | number)[]; pointers?: Record<string, number>; hl?: number[] }
	| { type: 'grid'; title?: string; cells: (string | number)[][]; rows?: string[]; cols?: string[]; hl?: [number, number][] };
export type Block = { kind: 'p'; children: Inline[] } | { kind: 'ul'; items: Inline[][] } | { kind: 'ol'; start: number; items: Inline[][] }
	| { kind: 'code'; lang: string; text: string; open?: true } | { kind: 'diagram'; diagram: Diagram } | { kind: 'quote'; text: string };
export type Placed = { node: TreeNode; x: number; y: number; parent?: Placed };

// CHAR: about 0.6em at 13px JetBrains Mono.
export const SLOT = 40, ROW = 72, PAD = 16, BOX = 28, NOTE = 16, CHAR = 8;
const INLINE = /`([^`\n]+)`|\*\*(\S(?:[\s\S]*?\S)?)\*\*|\*([^\s*](?:[^*]*[^\s*])?)\*/g;

function inline(text: string): Inline[] {
	const out: Inline[] = [];
	let at = 0;
	for (const m of text.matchAll(INLINE)) {
		if (m.index > at) out.push(text.slice(at, m.index));
		out.push(m[1] !== undefined ? { kind: 'code', text: m[1] } : { kind: m[2] !== undefined ? 'strong' : 'em', children: inline(m[2] ?? m[3]) });
		at = m.index + m[0].length;
	}
	if (at < text.length) out.push(text.slice(at));
	return out;
}

export function parseAnswer(text: string): Block[] {
	const blocks: Block[] = [], lines = text.split('\n');
	let paragraph: string[] | null = null;
	const close = () => { if (paragraph) blocks.push({ kind: 'p', children: inline(paragraph.join('\n')) }); paragraph = null; };
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		let m: RegExpExecArray | null;
		if ((m = /^( {0,3})```\s*([^\s`]*)[^`]*$/.exec(line))) {
			close();
			const indent = new RegExp(`^ {0,${m[1].length}}`), body: string[] = [], lang = m[2];
			while (++i < lines.length && !/^ {0,3}```\s*$/.test(lines[i])) body.push(lines[i].replace(indent, ''));
			const raw = body.join('\n'), diagram = lang === 'diagram' ? parseDiagram(raw) : null;
			if (diagram) blocks.push({ kind: 'diagram', diagram });
			else if (lang === 'lesson') blocks.push({ kind: 'quote', text: raw.replace(/\s+/g, ' ').trim() });
			else blocks.push(i < lines.length ? { kind: 'code', lang, text: raw } : { kind: 'code', lang, text: raw, open: true });
		} else if ((m = /^\s*(?:([-*+])|(\d{1,9})[.)])\s+(.*)$/.exec(line))) {
			close();
			const last = blocks.at(-1), item = inline(m[3]);
			if (last?.kind === (m[1] ? 'ul' : 'ol')) (last as { items: Inline[][] }).items.push(item);
			else blocks.push(m[1] ? { kind: 'ul', items: [item] } : { kind: 'ol', start: Number(m[2]), items: [item] });
		} else if ((m = /^#{1,6}\s+(.*)$/.exec(line))) { close(); blocks.push({ kind: 'p', children: [{ kind: 'strong', children: inline(m[1]) }] }); }
		else if (!line.trim()) close();
		else {
			const last = blocks.at(-1);
			if (!paragraph && /^\s/.test(line) && (last?.kind === 'ul' || last?.kind === 'ol')) last.items.at(-1)!.push('\n', ...inline(line.trim()));
			else (paragraph ??= []).push(line);
		}
	}
	close();
	return blocks;
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const only = (value: unknown, keys: string[]): value is Record<string, unknown> => record(value) && Object.keys(value).every(key => keys.includes(key));
const text = (value: unknown, max: number) => typeof value === 'string' && value.length <= max;
const cell = (value: unknown, max: number) => (typeof value === 'string' || typeof value === 'number') && String(value).length <= max;
const optional = (value: unknown, valid: (value: unknown) => boolean) => value === undefined || valid(value);
const index = (value: unknown, end: number) => Number.isInteger(value) && (value as number) >= 0 && (value as number) < end;

export function parseDiagram(body: string): Diagram | null {
	let d: unknown;
	try { d = JSON.parse(body); } catch { return null; }
	if (!record(d) || !optional(d.title, title => text(title, 80))) return null;
	let count = 0;
	const node = (value: unknown, depth: number): boolean => ++count <= 40 && depth <= 6 && only(value, ['label', 'note', 'hl', 'kind', 'children']) && text(value.label, 12) && optional(value.note, note => text(note, 12))
		&& optional(value.hl, hl => typeof hl === 'boolean') && optional(value.kind, kind => kind === 'answer' || kind === 'pruned') && optional(value.children, children => Array.isArray(children) && children.every(child => node(child, depth + 1)));
	const cells = d.cells, size = Array.isArray(cells) ? cells.length : 0, width = Array.isArray(cells) && Array.isArray(cells[0]) ? cells[0].length : 0;
	const labels = (value: unknown, length: number) => Array.isArray(value) && value.length === length && value.every(label => text(label, 6));
	const valid = d.type === 'tree' ? only(d, ['type', 'title', 'root']) && node(d.root, 0)
		: d.type === 'array' ? only(d, ['type', 'title', 'cells', 'pointers', 'hl']) && size >= 1 && size <= 24 && (cells as unknown[]).every(value => cell(value, 8))
			&& optional(d.pointers, pointers => record(pointers) && Object.keys(pointers).length <= 6 && Object.entries(pointers).every(([name, at]) => /^[A-Za-z_]\w{0,7}$/.test(name) && index(at, size + 1)))
			&& optional(d.hl, hl => Array.isArray(hl) && hl.length <= 24 && hl.every(at => index(at, size)))
		: d.type === 'grid' ? only(d, ['type', 'title', 'cells', 'rows', 'cols', 'hl']) && size >= 1 && size <= 12 && width >= 1 && width <= 12
			&& (cells as unknown[]).every(row => Array.isArray(row) && row.length === width && row.every(value => cell(value, 6)))
			&& optional(d.rows, rows => labels(rows, size)) && optional(d.cols, cols => labels(cols, width))
			&& optional(d.hl, hl => Array.isArray(hl) && hl.every(at => Array.isArray(at) && at.length === 2 && index(at[0], size) && index(at[1], width)))
		: false;
	return valid ? d as Diagram : null;
}

// Leaf slots: each leaf takes the next column, each parent centers between its first and last child.
export function layoutTree(root: TreeNode): { nodes: Placed[]; slot: number; width: number; height: number } {
	const nodes: Placed[] = [];
	let leaves = 0, depth = 0;
	const walk = (node: TreeNode, level: number, parent?: Placed): Placed => {
		const placed: Placed = { node, x: 0, y: PAD + BOX / 2 + level * ROW, parent };
		nodes.push(placed); depth = Math.max(depth, level);
		const children = node.children?.map(child => walk(child, level + 1, placed)) ?? [];
		placed.x = children.length ? (children[0].x + children.at(-1)!.x) / 2 : leaves++;
		return placed;
	};
	walk(root, 0);
	const slot = Math.max(SLOT, ...nodes.map(({ node }) => CHAR * Math.max(node.label.length, node.note?.length ?? 0) + 16));
	for (const placed of nodes) placed.x = PAD + slot / 2 + placed.x * slot;
	return { nodes, slot, width: 2 * PAD + leaves * slot, height: 2 * PAD + BOX + NOTE + depth * ROW };
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
const part = (label: string, items: string[]) => items.length ? ` ${label}: ${items.join(', ')}.` : '';

export function diagramLabel(d: Diagram): string {
	if (d.type === 'array') return `Array: ${d.cells.join(', ')}.${part('Pointers', Object.entries(d.pointers ?? {}).map(([name, at]) => `${name} at ${at}`))}${part('Highlighted', (d.hl ?? []).map(i => `${d.cells[i]} at ${i}`))}`;
	if (d.type === 'grid') return `Grid with ${plural(d.cells.length, 'row')} and ${plural(d.cells[0].length, 'column')}.${part('Highlighted', (d.hl ?? []).map(([row, col]) => `row ${row + 1} column ${col + 1}`))}`;
	const nodes = layoutTree(d.root).nodes.map(placed => placed.node);
	return `Tree with ${plural(nodes.length, 'node')}.${part('Highlighted', nodes.filter(node => node.hl).map(node => node.label))}${part('Answers', nodes.filter(node => node.kind === 'answer').map(node => node.label))}${part('Pruned', nodes.filter(node => node.kind === 'pruned').map(node => node.label))}`;
}
