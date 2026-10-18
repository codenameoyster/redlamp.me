import type { TestSpec } from './leetcode';

// The Python literals of the tests: int, float, str, True, False, None, list, tuple (as a list) and dict with str keys.
// One token: a number, a string in single or double quotes, a name or a mark. White space can come before each token.
const TOKEN = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)|'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|(True|False|None)\b|([[\](){},:]))/y;
const NAMES: Record<string, unknown> = { True: true, False: false, None: null };
// ponytail: other escapes (\x41, Ж, octal) throw a SyntaxError. Add them when a test needs them.
const ESCAPES: Record<string, string> = { '\\': '\\', "'": "'", '"': '"', n: '\n', r: '\r', t: '\t' };
const SHOWN: Record<string, string> = { '\n': '\\n', '\r': '\\r', '\t': '\\t' };

export function parsePy(text: string): unknown {
	let at = 0;
	const fail = (): never => { throw new SyntaxError(`No Python literal at character ${at + 1}.`); };
	function next(): RegExpExecArray {
		TOKEN.lastIndex = at;
		const match = TOKEN.exec(text) ?? fail();
		at = TOKEN.lastIndex;
		return match;
	}
	// Reads the items to the close mark. A comma can follow the last item.
	function sequence<T>(close: string, item: (match: RegExpExecArray) => T): { items: T[]; comma: boolean } {
		const items: T[] = [];
		let match = next(), comma = false;
		while (match[5] !== close) {
			items.push(item(match));
			match = next();
			if (match[5] === ',') { comma = true; match = next(); } else if (match[5] !== close) fail();
		}
		return { items, comma };
	}
	function value(match = next()): unknown {
		const [, number, single, double, name, mark] = match, string = single ?? double;
		if (number) return Number(number);
		if (string !== undefined) return string.replace(/\\(.)/g, (_, char: string) => ESCAPES[char] ?? fail());
		if (name) return NAMES[name];
		if (mark === '[') return sequence(']', value).items;
		// (5) is the number 5, (5,) is a tuple.
		if (mark === '(') { const { items, comma } = sequence(')', value); return items.length === 1 && !comma ? items[0] : items; }
		if (mark === '{') return Object.fromEntries(sequence('}', match => { const key = value(match); return [typeof key === 'string' && next()[5] === ':' ? key : fail(), value()]; }).items);
		return fail();
	}
	const result = value();
	if (text.slice(at).trim()) fail();
	return result;
}

// ponytail: a number prints as JavaScript prints it, so the float 2.0 prints as 2. The set references return no floats.
export function reprPy(value: unknown): string {
	if (value === null) return 'None';
	if (typeof value === 'boolean') return value ? 'True' : 'False';
	if (typeof value === 'number') return String(value);
	if (typeof value === 'string') {
		// Python takes double quotes when the text has a single quote and no double quote.
		const quote = value.includes("'") && !value.includes('"') ? '"' : "'";
		return quote + value.replace(/[\\'"\x00-\x1f\x7f]/g, char => char === '\\' || char === quote ? `\\${char}` : char === "'" || char === '"' ? char : SHOWN[char] ?? `\\x${char.charCodeAt(0).toString(16).padStart(2, '0')}`) + quote;
	}
	if (Array.isArray(value)) return `[${value.map(reprPy).join(', ')}]`;
	if (typeof value === 'object') return `{${Object.entries(value).map(([key, item]) => `${reprPy(key)}: ${reprPy(item)}`).join(', ')}}`;
	throw new TypeError(`No Python literal for ${typeof value}.`);
}

// Stdout compares token by token. Other answers compare Python literals with the specified list order.
function canonical(spec: TestSpec, answer: string): string {
	if (spec.mode === 'stdio') return answer.split(/\s+/).filter(Boolean).join(' ');
	const value = parsePy(answer), order = spec.order ?? 'exact';
	return order === 'exact' ? reprPy(value) : JSON.stringify((value as unknown[]).map(item => order === 'any' ? reprPy(item) : JSON.stringify((item as unknown[]).map(reprPy).sort())).sort());
}

// An output that is not a Python literal, or not a list for a free order, is a wrong answer.
export function same(spec: TestSpec, expected: string, output: string): boolean {
	try { return canonical(spec, expected) === canonical(spec, output); } catch { return false; }
}
