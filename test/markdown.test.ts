import { expect, it } from 'vitest';
import { diagramLabel, layoutTree, parseAnswer, type Block, type Diagram, type Inline, type TreeNode } from '../web/markdown';

const p = (...children: Inline[]): Block => ({ kind: 'p', children });
const strong = (...children: Inline[]): Inline => ({ kind: 'strong', children });
const em = (...children: Inline[]): Inline => ({ kind: 'em', children });
const code = (text: string): Inline => ({ kind: 'code', text });
const block = (lang: string, text: string, open?: true): Block => open ? { kind: 'code', lang, text, open } : { kind: 'code', lang, text };
const fence = (body: string) => `\`\`\`diagram\n${body}\n\`\`\``;
const leaves = (count: number): TreeNode[] => Array.from({ length: count }, (_, index) => ({ label: String(index) }));
const chain = (levels: number): TreeNode => levels === 1 ? { label: 'x' } : { label: 'x', children: [chain(levels - 1)] };
const tree = (root: unknown) => JSON.stringify({ type: 'tree', root });
const array = (fields: object) => JSON.stringify({ type: 'array', cells: [1, 2, 3], ...fields });
const grid = (fields: object) => JSON.stringify({ type: 'grid', cells: [[1, 2], [3, 4]], ...fields });
const subsets: Diagram = { type: 'tree', title: 'Choose 2 of [1,2,3]', root: { label: '[]', hl: true, children: [{ label: '[1]', hl: true, children: [{ label: '[1,2]', hl: true, kind: 'answer' }, { label: '[1,3]', kind: 'answer' }] }, { label: '[2]', children: [{ label: '[2,3]', kind: 'answer' }] }, { label: '[3]', kind: 'pruned', note: 'too few' }] } };

it.each([
	{ name: 'plain paragraph', input: 'Try a smaller input.', expected: [p('Try a smaller input.')] },
	{ name: 'blank line splits paragraphs', input: 'A\n\nB', expected: [p('A'), p('B')] },
	{ name: 'single newline stays in the paragraph', input: 'A\nB', expected: [p('A\nB')] },
	{ name: 'bold, italic and inline code', input: 'Use **two pointers** and *move* `i`.', expected: [p('Use ', strong('two pointers'), ' and ', em('move'), ' ', code('i'), '.')] },
	{ name: 'code inside bold', input: '**`i` moves**', expected: [p(strong(code('i'), ' moves'))] },
	{ name: 'spaced stars stay text', input: '2 * 3 * 4', expected: [p('2 * 3 * 4')] },
	{ name: 'markup inside inline code stays text', input: '`**x**`', expected: [p(code('**x**'))] },
	{ name: 'html stays text', input: '<img src=x onerror=alert(1)>', expected: [p('<img src=x onerror=alert(1)>')] },
	{ name: 'link stays text', input: '[docs](javascript:alert(1))', expected: [p('[docs](javascript:alert(1))')] },
	{ name: 'bullet list', input: '- a\n- b', expected: [{ kind: 'ul', items: [['a'], ['b']] }] },
	{ name: 'ordered list keeps its start number', input: '3. c\n4. d', expected: [{ kind: 'ol', start: 3, items: [['c'], ['d']] }] },
	{ name: 'blank line between items keeps one list', input: '1. a\n\n2. b', expected: [{ kind: 'ol', start: 1, items: [['a'], ['b']] }] },
	{ name: 'paragraph between items starts a new list', input: '1. a\n\nText\n\n2. b', expected: [{ kind: 'ol', start: 1, items: [['a']] }, p('Text'), { kind: 'ol', start: 2, items: [['b']] }] },
	{ name: 'indented line continues the item', input: '- a\n  more', expected: [{ kind: 'ul', items: [['a', '\n', 'more']] }] },
	{ name: 'heading becomes a bold paragraph', input: '### Hint 1', expected: [p(strong('Hint 1'))] },
	{ name: 'fenced code keeps indentation', input: '```python\nfor i in range(n):\n    pass\n```', expected: [block('python', 'for i in range(n):\n    pass')] },
	{ name: 'unclosed fence runs to the end', input: '```\nx = 1', expected: [block('', 'x = 1', true)] },
	{ name: 'indented fence after a list item', input: '1. Check:\n   ```python\n   if i > n:\n   ```', expected: [{ kind: 'ol', start: 1, items: [['Check:']] }, block('python', 'if i > n:')] },
	{ name: 'lesson fence becomes a quote', input: '```lesson\nEach circle is\none call.\n```', expected: [{ kind: 'quote', text: 'Each circle is one call.' }] },
	{ name: 'unclosed diagram fence', input: '```diagram\n{"type":', expected: [block('diagram', '{"type":', true)] },
	{ name: 'fence info with symbols', input: '```c++\nint x = a * b;\n```\nNow test n = 0.', expected: [block('c++', 'int x = a * b;'), p('Now test n = 0.')] },
	{ name: 'space before the fence info', input: '``` python\nx = 1\n```\nMore.', expected: [block('python', 'x = 1'), p('More.')] },
])('$name', ({ input, expected }) => {
	expect(parseAnswer(input)).toEqual(expected);
});

it.each([
	{ name: 'valid tree diagram', body: JSON.stringify(subsets), valid: true },
	{ name: 'tree with 40 nodes', body: tree({ label: 'r', children: leaves(39) }), valid: true },
	{ name: 'tree with depth 6', body: tree(chain(7)), valid: true },
	{ name: 'array pointer one past the end', body: array({ pointers: { j: 3 } }), valid: true },
	{ name: 'negative and fraction cell values', body: array({ cells: [-1, 0.5] }), valid: true },
	{ name: 'array with 24 cells', body: array({ cells: Array(24).fill(0) }), valid: true },
	{ name: 'grid with headers and highlights', body: grid({ cells: [[1, 2, 3], [4, 5, 6]], rows: ['a', 'b'], cols: ['x', 'y', 'z'], hl: [[1, 2]] }), valid: true },
	{ name: 'invalid JSON shows as code', body: '{type: tree}', valid: false },
	{ name: 'unknown diagram type', body: JSON.stringify({ type: 'graph', root: { label: 'r' } }), valid: false },
	{ name: 'unknown key', body: array({ color: 'red' }), valid: false },
	{ name: 'tree with 41 nodes', body: tree({ label: 'r', children: leaves(40) }), valid: false },
	{ name: 'tree deeper than 6', body: tree(chain(8)), valid: false },
	{ name: 'tree label over 12 characters', body: tree({ label: 'abcdefghijklm' }), valid: false },
	{ name: 'tree node kind outside the list', body: tree({ label: 'r', kind: 'best' }), valid: false },
	{ name: 'array pointer two past the end', body: array({ pointers: { j: 4 } }), valid: false },
	{ name: 'array pointer name with a space', body: array({ pointers: { 'my i': 0 } }), valid: false },
	{ name: 'array pointer that is a fraction', body: array({ pointers: { i: 0.5 } }), valid: false },
	{ name: 'empty array', body: array({ cells: [] }), valid: false },
	{ name: 'array with 25 cells', body: array({ cells: Array(25).fill(0) }), valid: false },
	{ name: 'array cell that is an object', body: array({ cells: [{ v: 1 }] }), valid: false },
	{ name: 'array cell that is a boolean', body: array({ cells: [true] }), valid: false },
	{ name: 'array cell over 8 characters', body: array({ cells: ['abcdefghi'] }), valid: false },
	{ name: 'grid with rows of different length', body: grid({ cells: [[1, 2], [3]] }), valid: false },
	{ name: 'grid with 13 columns', body: grid({ cells: [Array(13).fill(0)] }), valid: false },
	{ name: 'grid highlight outside the grid', body: grid({ cells: [[1]], hl: [[0, 1]] }), valid: false },
	{ name: 'grid row headers do not match rows', body: grid({ rows: ['a'] }), valid: false },
])('$name', ({ body, valid }) => {
	expect(parseAnswer(fence(body))).toEqual([valid ? { kind: 'diagram', diagram: JSON.parse(body) } : block('diagram', body)]);
});

it.each([
	{ name: 'single node', root: { label: 'r' }, nodes: [['r', 36, 30]], slot: 40, width: 72, height: 76 },
	{ name: 'root with two leaves', root: { label: 'r', children: [{ label: 'a' }, { label: 'b' }] }, nodes: [['r', 56, 30], ['a', 36, 102], ['b', 76, 102]], slot: 40, width: 112, height: 148 },
	{ name: 'chain stays in one column', root: chain(3), nodes: [['x', 36, 30], ['x', 36, 102], ['x', 36, 174]], slot: 40, width: 72, height: 220 },
	{ name: 'parent centers over its first and last child', root: { label: 'r', children: [{ label: 'A', children: [{ label: 'a1' }, { label: 'a2' }] }, { label: 'B' }] }, nodes: [['r', 86, 30], ['A', 56, 102], ['a1', 36, 174], ['a2', 76, 174], ['B', 116, 102]], slot: 40, width: 152, height: 220 },
	{ name: 'long label widens every slot', root: { label: '[1, 2, 3]' }, nodes: [['[1, 2, 3]', 60, 30]], slot: 88, width: 120, height: 76 },
	{ name: 'long note widens every slot', root: { label: 'r', children: [{ label: 'a', note: 'too few' }, { label: 'b' }] }, nodes: [['r', 88, 30], ['a', 52, 102], ['b', 124, 102]], slot: 72, width: 176, height: 148 },
])('$name', ({ root, nodes, slot, width, height }) => {
	const layout = layoutTree(root);
	expect({ nodes: layout.nodes.map(placed => [placed.node.label, placed.x, placed.y]), slot: layout.slot, width: layout.width, height: layout.height }).toEqual({ nodes, slot, width, height });
});

it.each([
	{ name: 'tree label', diagram: subsets, expected: 'Tree with 7 nodes. Highlighted: [], [1], [1,2]. Answers: [1,2], [1,3], [2,3].' },
	{ name: 'tree label without marks', diagram: { type: 'tree', root: { label: 'r' } } as Diagram, expected: 'Tree with 1 node.' },
	{ name: 'array label', diagram: { type: 'array', cells: [1, 5, 3, 4], pointers: { i: 0, j: 3 } } as Diagram, expected: 'Array: 1, 5, 3, 4. Pointers: i at 0, j at 3.' },
	{ name: 'grid label', diagram: { type: 'grid', cells: [['S', '.', '.'], ['.', '#', '.'], ['.', '.', 'E']], hl: [[0, 0], [0, 1]] } as Diagram, expected: 'Grid with 3 rows and 3 columns. Highlighted: row 1 column 1, row 1 column 2.' },
])('$name', ({ diagram, expected }) => {
	expect(diagramLabel(diagram)).toBe(expected);
});
