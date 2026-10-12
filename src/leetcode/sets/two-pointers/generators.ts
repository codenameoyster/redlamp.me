import type { Generator } from '..';

// The hidden tests of the set "two-pointers". Each generator gives the edge cases of the statement, then random medium inputs, then 2 inputs at the maximum sizes.
// A call input is a Python literal list of the arguments. JSON of integers and printable ASCII strings is a Python literal too.

type Random = () => number;

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const PRINTABLE = String.fromCharCode(...Array.from({ length: 95 }, (_, i) => i + 32));

// A random integer in [lo, hi].
const between = (random: Random, lo: number, hi: number): number => lo + Math.floor(random() * (hi - lo + 1));
const list = (random: Random, n: number, lo: number, hi: number): number[] => Array.from({ length: n }, () => between(random, lo, hi));
const asc = (values: number[]): number[] => values.sort((a, b) => a - b);
const charOf = (random: Random, chars: string): string => chars[between(random, 0, chars.length - 1)];
const text = (random: Random, n: number, chars: string): string => Array.from({ length: n }, () => charOf(random, chars)).join('');
const call = (cases: unknown[][]): string[] => cases.map(args => JSON.stringify(args));

export default {
	'two-sum-ii-input-array-is-sorted': (random: Random) => {
		// The pair x + y = t is the answer. Of each other pair of values with the sum t, the pool keeps one value, so the answer is unique.
		// spread keeps all values near t / 2, so a small spread gives many duplicates.
		const make = (n: number, t: number, spread: number): [number[], number] => {
			const x = between(random, Math.max(-1000, t - 1000, Math.ceil((t - spread) / 2)), Math.floor(t / 2)), y = t - x, pool: number[] = [];
			for (let v = -1000; v <= 1000; v++) {
				const w = t - v;
				if (v === x || v === y || 2 * v === t || Math.abs(2 * v - t) > spread) continue;
				if (w < -1000 || w > 1000) pool.push(v);
				else if (v < w) pool.push(random() < 0.5 ? v : w);
			}
			return [asc([x, y, ...Array.from({ length: n - 2 }, () => pool[between(random, 0, pool.length - 1)])]), t];
		};
		return call([
			[[-1000, 1000], 0], [[-500, -500], -1000], [[500, 500], 1000], [[0, 0, 3, 4], 0], [[1, 3, 5, 7, 100], 101], [[-3, -1, 0, 2, 2, 2, 5], 5],
			...Array.from({ length: 5 }, () => make(between(random, 3, 60), between(random, -1000, 1000), between(random, 10, 4000))),
			make(30000, between(random, -1000, 1000), 4000), make(30000, between(random, -1000, 1000), 40),
		]);
	},
	'valid-palindrome': (random: Random) => {
		const ALNUM = LOWER + LOWER.toUpperCase() + '0123456789', OTHER = PRINTABLE.replace(/[a-z0-9]/gi, ''), alnum = (c: string) => /[a-z0-9]/i.test(c);
		// The right half mirrors the letters and digits of the left half in random case, with other random characters between them. n is 2 or more.
		const make = (n: number, palindrome: boolean): [string] => {
			const left = Array.from({ length: n >> 1 }, () => charOf(random, random() < 0.7 ? ALNUM : OTHER));
			const right = left.map(c => alnum(c) ? random() < 0.5 ? c.toUpperCase() : c.toLowerCase() : charOf(random, OTHER)).reverse();
			if (!palindrome) { const i = between(random, 0, right.length - 1); right[i] = right[i].toLowerCase() === 'a' ? 'b' : 'a'; }
			return [left.join('') + (n % 2 ? charOf(random, PRINTABLE) : '') + right.join('')];
		};
		return call([
			[' '], ['a'], ['.,'], ['0P'], ['Aa'], ['ab@#BA'], ['\\\'"'], ['1a2'],
			...Array.from({ length: 4 }, () => make(between(random, 2, 60), random() < 0.5)), [text(random, between(random, 1, 60), PRINTABLE)],
			make(200000, true), make(200000, false),
		]);
	},
	'max-number-of-k-sum-pairs': (random: Random) => {
		// Most values are x or k - x for a few random x. The other values are random noise up to hi.
		const make = (n: number, k: number, kinds: number, hi: number): [number[], number] => {
			const xs = list(random, kinds, 1, k - 1);
			return [Array.from({ length: n }, () => { const x = xs[between(random, 0, kinds - 1)]; return random() < 0.2 ? between(random, 1, hi) : random() < 0.5 ? x : k - x; }), k];
		};
		return call([
			[[5], 10], [[1, 1], 2], [[1, 1, 1], 2], [[2, 2, 2, 2], 4], [[1, 1], 1], [[1e9, 1e9], 1e9], [[1, 999999999], 1e9],
			...Array.from({ length: 5 }, () => make(between(random, 2, 60), between(random, 2, 20), between(random, 1, 4), 30)),
			make(100000, between(random, 2, 1e9), 50, 1e9), make(100000, 1000, 500, 1000),
		]);
	},
	'container-with-most-water': (random: Random) => call([
		[[1, 1]], [[0, 0]], [[0, 10000]], [[10000, 10000]], [[1, 2, 3, 4, 5]], [[5, 4, 3, 2, 1]], [[2, 2, 2, 2]], [[10000, 0, 0, 0, 10000]],
		...Array.from({ length: 4 }, () => [list(random, between(random, 3, 60), 0, between(random, 1, 10000))]),
		[list(random, 100000, 0, 10000)], [Array(100000).fill(10000)],
	]),
	'boats-to-save-people': (random: Random) => call([
		[[1], 1], [[1, 1], 2], [[1, 1], 1], [[30000, 30000], 30000], [[1, 29999], 30000], [[2, 2, 2, 2], 4], [[5, 1, 4, 2], 6],
		...Array.from({ length: 4 }, () => { const limit = between(random, 1, 100); return [list(random, between(random, 2, 60), 1, limit), limit]; }),
		[list(random, 50000, 1, 30000), 30000], [list(random, 50000, 15000, 30000), 30000],
	]),
	'remove-duplicates-from-sorted-array': (random: Random) => call([
		[[7]], [[-100]], [[100, 100]], [[-100, 100]], [[1, 1, 1, 1]], [Array.from({ length: 201 }, (_, i) => i - 100)],
		...Array.from({ length: 4 }, () => { const lo = between(random, -100, 100); return [asc(list(random, between(random, 2, 60), lo, Math.min(100, lo + between(random, 0, 20))))]; }),
		[asc(list(random, 30000, -100, 100))], [Array(30000).fill(100)],
	]),
	'remove-element': (random: Random) => {
		// val is a value of nums in most inputs.
		const make = (n: number, hi: number): [number[], number] => { const nums = list(random, n, 0, hi); return [nums, random() < 0.8 ? nums[between(random, 0, n - 1)] : between(random, 0, 100)]; };
		return call([
			[[], 0], [[], 100], [[1], 1], [[1], 2], [[50, 50, 50], 50], [[0, 1, 2], 100], [[0, 0, 1], 0],
			...Array.from({ length: 4 }, () => make(between(random, 1, 30), between(random, 0, 50))),
			make(100, 50), [Array(100).fill(37), 37],
		]);
	},
	'move-zeroes': (random: Random) => {
		const MIN = -(2 ** 31), MAX = 2 ** 31 - 1;
		const make = (n: number, zeros: number, lo: number, hi: number): [number[]] => [Array.from({ length: n }, () => random() < zeros ? 0 : between(random, lo, hi))];
		return call([
			[[0]], [[1]], [[0, 0, 0]], [[1, 2, 3]], [[MIN, 0, MAX]], [[0, 0, 1]], [[1, 0, 0]], [[0, -1, 0, -2]],
			...Array.from({ length: 4 }, () => make(between(random, 1, 60), random(), -1000, 1000)),
			make(10000, 0.3, MIN, MAX), [[...Array(5000).fill(0), ...list(random, 5000, 1, MAX)]],
		]);
	},
	'remove-duplicates-from-sorted-array-ii': (random: Random) => call([
		[[5]], [[5, 5]], [[5, 5, 5]], [[-10000, -10000, -10000, 10000, 10000, 10000]], [[1, 2, 3]], [[0, 0, 0, 0, 0, 0]], [[1, 1, 2, 2, 2, 3, 3, 3, 3]],
		...Array.from({ length: 4 }, () => { const lo = between(random, -10000, 9990); return [asc(list(random, between(random, 2, 60), lo, lo + between(random, 0, 10)))]; }),
		[asc(list(random, 30000, -10000, 10000))], [asc(list(random, 30000, -5, 5))],
	]),
	'sort-colors': (random: Random) => call([
		[[0]], [[1]], [[2]], [[2, 1, 0]], [[2, 2, 2]], [[0, 0, 1, 1]], [[1, 0]], [[2, 0, 2, 0]],
		...Array.from({ length: 4 }, () => [list(random, between(random, 2, 60), 0, 2)]),
		[list(random, 300, 0, 2)], [[...Array(100).fill(2), ...Array(100).fill(1), ...Array(100).fill(0)]],
	]),
	'merge-sorted-array': (random: Random) => {
		// nums1 holds m sorted values and n zeros at the end.
		const make = (m: number, n: number, hi: number): [number[], number, number[], number] => [[...asc(list(random, m, -hi, hi)), ...Array(n).fill(0)], m, asc(list(random, n, -hi, hi)), n];
		return call([
			[[1], 1, [], 0], [[0], 0, [1], 1], [[4, 5, 6, 0, 0, 0], 3, [1, 2, 3], 3], [[1, 2, 3, 0, 0, 0], 3, [4, 5, 6], 3], [[2, 2, 0, 0], 2, [2, 2], 2], [[-1e9, 1e9, 0], 2, [0], 1], [[0, 0, 0], 0, [-5, -5, -5], 3],
			...Array.from({ length: 4 }, () => { const m = between(random, 0, 30); return make(m, between(random, m ? 0 : 1, 30), random() < 0.5 ? 20 : 1e9); }),
			make(100, 100, 1e9), make(1, 199, 1e9),
		]);
	},
	'is-subsequence': (random: Random) => {
		// s takes size letters of t in order (selection sampling). A changed letter can break the subsequence.
		const sample = (t: string, size: number): string => { let s = ''; for (let j = 0; j < t.length && s.length < size; j++) if (random() * (t.length - j) < size - s.length) s += t[j]; return s; };
		const make = (t: string, size: number, change: boolean): [string, string] => {
			const s = sample(t, size), i = between(random, 0, s.length - 1);
			return [change && s ? s.slice(0, i) + charOf(random, 'abc') + s.slice(i + 1) : s, t];
		};
		const big = text(random, 10000, LOWER), noZ = text(random, 10000, LOWER.slice(0, 25));
		return call([
			['', ''], ['', 'abc'], ['a', ''], ['abc', 'abc'], ['aaaa', 'aaa'], ['b', 'abc'], ['abc', 'cba'], ['z', 'aaaaz'],
			...Array.from({ length: 4 }, () => { const t = text(random, between(random, 0, 200), random() < 0.5 ? 'abc' : LOWER); return make(t, between(random, 0, Math.min(10, t.length)), random() < 0.5); }),
			[sample(big, 100), big], [sample(noZ, 99) + 'z', noZ],
		]);
	},
	'merge-strings-alternately': (random: Random) => call([
		['a', 'b'], ['a', 'bcdef'], ['abcde', 'f'], ['ab', 'ab'], ['a'.repeat(100), 'b'], ['x', 'y'.repeat(100)],
		...Array.from({ length: 4 }, () => [text(random, between(random, 1, 30), LOWER), text(random, between(random, 1, 30), LOWER)]),
		[text(random, 100, LOWER), text(random, 100, LOWER)], [text(random, 100, LOWER), text(random, 100, LOWER)],
	]),
	'intersection-of-two-arrays': (random: Random) => call([
		[[0], [0]], [[1000], [0]], [[1, 1, 1], [1]], [[1, 2, 3], [4, 5, 6]], [[5, 4, 3], [3, 4, 5]], [[0, 1000], [1000, 0, 0]],
		...Array.from({ length: 4 }, () => { const hi = between(random, 0, 30); return [list(random, between(random, 1, 40), 0, hi), list(random, between(random, 1, 40), 0, hi)]; }),
		[list(random, 1000, 0, 1000), list(random, 1000, 0, 1000)], [list(random, 1000, 0, 30), list(random, 1000, 0, 30)],
	]),
	'cf-1538-c': (random: Random) => {
		// One test set: the line "n l r", then the line of a. l and r stay near the sums of two values.
		const block = (n: number, hi: number): string => {
			const top = Math.min(2 * hi, 1e9), l = between(random, 1, top), r = between(random, l, top);
			return `${n} ${l} ${r}\n${list(random, n, 1, hi).join(' ')}\n`;
		};
		const input = (blocks: string[]): string => `${blocks.length}\n${blocks.join('')}`;
		return [
			'1\n1 1 1\n1\n', '1\n2 2 2\n1 1\n', '1\n2 1 1000000000\n1000000000 1000000000\n', '1\n4 2 1000000000\n1 1 1 1\n', '1\n5 1 1\n1 1 1 1 1\n',
			'3\n3 4 7\n5 1 2\n1 1 1\n7\n2 1000000000 1000000000\n500000000 500000000\n',
			...Array.from({ length: 4 }, () => input(Array.from({ length: between(random, 1, 5) }, () => block(between(random, 1, 30), between(random, 1, 20))))),
			input([block(200000, 1e9)]), input(Array.from({ length: 10000 }, () => block(20, 1e9))),
		];
	},
	'3sum': (random: Random) => call([
		[[0, 0, 0]], [[0, 1, 1]], [[0, 0, 0, 0]], [[1, 2, 3]], [[-100000, 50000, 50000]], [[-100000, 0, 100000]], [[-2, 0, 1, 1, 2]], [[-1, -1, -1, 2, 2, 2]],
		...Array.from({ length: 4 }, () => [list(random, between(random, 3, 60), -10, 10)]),
		[list(random, 3000, -100000, 100000)], [list(random, 3000, -2, 2).map(x => x * 50000)],
	]),
	'string-compression': (random: Random) => {
		// Groups of one random character with random lengths up to most. Two near groups can have the same character and join.
		const make = (n: number, chars: string, most: number): [string[]] => {
			const out: string[] = [];
			while (out.length < n) out.push(...Array<string>(Math.min(between(random, 1, most), n - out.length)).fill(charOf(random, chars)));
			return [out];
		};
		return call([
			[['a']], [['a', 'a']], [Array(10).fill('a')], [['a', 'b', 'c']], [['1', '1', '1']], [["'", "'", '\\']], [['a', 'A', 'a']], [Array(100).fill(' ')],
			...Array.from({ length: 4 }, () => make(between(random, 1, 60), 'aAb1 \'', 12)),
			[Array(2000).fill('z')], make(2000, PRINTABLE, 150),
		]);
	},
} satisfies Record<string, Generator>;
