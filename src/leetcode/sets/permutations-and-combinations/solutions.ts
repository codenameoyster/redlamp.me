import type { Reference } from '..';
import { int, ints, need, reader, str } from '../constraints';

const distinct = (list: number[]): number[] => { need(new Set(list).size === list.length); return list; };

// Changes a to the next permutation in lexicographic order. Returns false when a goes back to the ascending order.
function nextPermutation(a: number[]): boolean {
	let i = a.length - 2;
	while (i >= 0 && a[i] >= a[i + 1]) i--;
	if (i >= 0) { let j = a.length - 1; while (a[j] <= a[i]) j--; [a[i], a[j]] = [a[j], a[i]]; }
	for (let l = i + 1, r = a.length - 1; l < r; l++, r--) [a[l], a[r]] = [a[r], a[l]];
	return i >= 0;
}

// Sorting plus Next Permutation takes O(n log n + n * P) time for P distinct permutations. Copies store n * P output entries.
function permutations(nums: number[]): number[][] {
	const a = [...nums].sort((x, y) => x - y), out = [a.slice()];
	while (nextPermutation(a)) out.push(a.slice());
	return out;
}

export default {
	// O(t * |s|): the first '?' gives 9 digits, every other '?' gives 10.
	'cf-1821-a': { mode: 'stdio', solve: (stdin: string) => {
		const input = reader(stdin), out: number[] = [];
		for (let t = input.int(1, 20000); t > 0; t--) { const s = input.word(/^[0-9?]{1,5}$/); out.push((s[0] === '0' ? 0 : s[0] === '?' ? 9 : 1) * 10 ** (s.slice(1).split('?').length - 1)); }
		input.end();
		return out.join('\n') + '\n';
	} },
	// O(t * n): choose 2 of the 10 - n allowed digits, then place them in C(4, 2) = 6 ways.
	'cf-1743-a': { mode: 'stdio', solve: (stdin: string) => {
		const input = reader(stdin), out: number[] = [];
		for (let t = input.int(1, 200); t > 0; t--) {
			const n = input.int(1, 8);
			// The statement gives the digits in increasing order.
			for (let j = 0, last = -1; j < n; j++) last = input.int(last + 1, 9);
			out.push(3 * (10 - n) * (9 - n));
		}
		input.end();
		return out.join('\n') + '\n';
	} },
	// O(n^2): a row or a column with c chocolates gives C(c, 2) pairs.
	'cf-629-a': { mode: 'stdio', solve: (stdin: string) => {
		const input = reader(stdin), n = input.int(1, 100), rows = Array<number>(n).fill(0), cols = Array<number>(n).fill(0);
		for (let r = 0; r < n; r++) { const line = input.word(/^[.C]+$/); need(line.length === n); for (let c = 0; c < n; c++) if (line[c] === 'C') { rows[r]++; cols[c]++; } }
		input.end();
		return `${[...rows, ...cols].reduce((pairs, c) => pairs + c * (c - 1) / 2, 0)}\n`;
	} },
	// O(t): each first letter owns 25 words, and the second letter skips the first letter.
	'cf-1674-b': { mode: 'stdio', solve: (stdin: string) => {
		const input = reader(stdin), out: number[] = [];
		for (let t = input.int(1, 650); t > 0; t--) {
			const s = input.word(/^[a-z]{2}$/), a = s.charCodeAt(0) - 97, b = s.charCodeAt(1) - 97;
			need(a !== b);
			out.push(a * 25 + (b < a ? b : b - 1) + 1);
		}
		input.end();
		return out.join('\n') + '\n';
	} },
	// O(n): each value makes a pair with every equal value before it.
	'number-of-good-pairs': { mode: 'call', solve: (nums: unknown) => { const seen = Array<number>(101).fill(0); return ints(nums, 1, 100, 1, 100).reduce((pairs, x) => pairs + seen[x]++, 0); } },
	// For n characters and l letters, at most n * 2^l prefix extensions produce n * 2^l output characters. String-copy costs depend on the engine.
	'letter-case-permutation': { mode: 'call', solve: (s: unknown) => [...str(s, /^[a-zA-Z0-9]{1,12}$/)].reduce((out, c) => out.flatMap(p => /\d/.test(c) ? [p + c] : [p + c.toLowerCase(), p + c.toUpperCase()]), ['']) },
	// O(n * 2^n): every number extends all the subsets before it.
	subsets: { mode: 'call', solve: (nums: unknown) => distinct(ints(nums, 1, 10, -10, 10)).reduce<number[][]>((out, x) => out.concat(out.map(set => [...set, x])), [[]]) },
	// O(n * n!).
	permutations: { mode: 'call', solve: (nums: unknown) => permutations(distinct(ints(nums, 1, 6, -10, 10))) },
	// O(k * C(n, k)): the search stops when too few numbers are left to fill the combination.
	combinations: { mode: 'call', solve: (n: unknown, k: unknown) => {
		const top = int(n, 1, 20), size = int(k, 1, top), out: number[][] = [], cur: number[] = [];
		const go = (from: number): void => { if (cur.length === size) out.push(cur.slice()); else for (let x = from; x <= top - size + cur.length + 1; x++) { cur.push(x); go(x + 1); cur.pop(); } };
		go(1);
		return out;
	} },
	// O(4^n * n).
	'letter-combinations-of-a-phone-number': { mode: 'call', solve: (digits: unknown) => {
		const keys = ['', '', 'abc', 'def', 'ghi', 'jkl', 'mno', 'pqrs', 'tuv', 'wxyz'];
		return [...str(digits, /^[2-9]{1,4}$/)].reduce((out, d) => out.flatMap(p => [...keys[Number(d)]].map(c => p + c)), ['']);
	} },
	// O(n * 2^n): after the sort, a repeated number extends only the subsets that its previous copy made.
	'subsets-ii': { mode: 'call', solve: (nums: unknown) => {
		const a = [...ints(nums, 1, 10, -10, 10)].sort((x, y) => x - y), out: number[][] = [[]];
		for (let i = 0, previous = 0; i < a.length; i++) {
			const from = i > 0 && a[i] === a[i - 1] ? previous : 0;
			previous = out.length;
			for (let j = from; j < previous; j++) out.push([...out[j], a[i]]);
		}
		return out;
	} },
	// O(n log n + n * P) time for Sorting and P distinct permutations.
	'permutations-ii': { mode: 'call', solve: (nums: unknown) => permutations(ints(nums, 1, 8, -10, 10)) },
	// The search goes over the sorted candidates. A branch stops when the next candidate is larger than the rest of the target.
	'combination-sum': { mode: 'call', solve: (candidates: unknown, target: unknown) => {
		const a = [...distinct(ints(candidates, 1, 30, 2, 40))].sort((x, y) => x - y), goal = int(target, 1, 40), out: number[][] = [], cur: number[] = [];
		const go = (from: number, left: number): void => { if (!left) out.push(cur.slice()); else for (let i = from; i < a.length && a[i] <= left; i++) { cur.push(a[i]); go(i, left - a[i]); cur.pop(); } };
		go(0, goal);
		// The statement guarantees fewer than 150 combinations.
		need(out.length < 150);
		return out;
	} },
	// O(4^n / sqrt(n)): add '(' while pairs are left, add ')' while it closes an open one.
	'generate-parentheses': { mode: 'call', solve: (n: unknown) => {
		const pairs = int(n, 1, 8), out: string[] = [];
		const go = (s: string, open: number, close: number): void => { if (close === pairs) out.push(s); if (open < pairs) go(s + '(', open + 1, close); if (close < open) go(s + ')', open, close + 1); };
		go('', 0, 0);
		return out;
	} },
	// O(n * 360): the set of reachable angles modulo 360 after each rotation.
	'cf-1097-b': { mode: 'stdio', solve: (stdin: string) => {
		const input = reader(stdin);
		let reach = [0];
		for (let i = input.int(1, 15); i > 0; i--) { const a = input.int(1, 180); reach = [...new Set(reach.flatMap(r => [(r + a) % 360, (r - a + 360) % 360]))]; }
		input.end();
		return reach.includes(0) ? 'YES\n' : 'NO\n';
	} },
	// O(n) time and O(1) extra memory.
	'next-permutation': { mode: 'call', solve: (nums: unknown) => { const a = ints(nums, 1, 100, 0, 100); nextPermutation(a); return a; } },
	// O(min(m, n)): the answer is C(m + n - 2, min(m, n) - 1).
	'unique-paths': { mode: 'call', solve: (m: unknown, n: unknown) => {
		const rows = int(m, 1, 100), cols = int(n, 1, 100), k = Math.min(rows, cols) - 1, rest = rows + cols - 2 - k;
		let paths = 1;
		// paths = C(rest + i, i) grows with i. The statement guarantees an answer of at most 2 · 10^9, so a larger value fails at once.
		for (let i = 1; i <= k; i++) { paths = paths * (rest + i) / i; need(paths <= 2e9); }
		return paths;
	} },
	// O(n^2): the factorial number system of k - 1 gives the digit at each position.
	'permutation-sequence': { mode: 'call', solve: (n: unknown, k: unknown) => {
		const size = int(n, 1, 9), factorial = [1];
		for (let i = 1; i <= size; i++) factorial.push(factorial[i - 1] * i);
		const left = Array.from({ length: size }, (_, i) => i + 1);
		let rest = int(k, 1, factorial[size]) - 1, out = '';
		for (let i = size - 1; i >= 0; i--) { out += left.splice(Math.floor(rest / factorial[i]), 1)[0]; rest %= factorial[i]; }
		return out;
	} },
	// With bounded masks, the search takes O(n!) time and O(n) auxiliary state. Constructing Q boards adds O(n^2 * Q) time and output characters.
	'n-queens': { mode: 'call', solve: (n: unknown) => {
		const size = int(n, 1, 9), full = (1 << size) - 1, out: string[][] = [], cols: number[] = [];
		const go = (row: number, used: number, left: number, right: number): void => {
			if (row === size) out.push(cols.map(c => '.'.repeat(c) + 'Q' + '.'.repeat(size - c - 1)));
			for (let free = full & ~(used | left | right); free; free &= free - 1) { const bit = free & -free; cols[row] = 31 - Math.clz32(bit); go(row + 1, used | bit, ((left | bit) << 1) & full, (right | bit) >> 1); }
		};
		go(0, 0, 0, 0);
		return out;
	} },
} satisfies Record<string, Reference>;
