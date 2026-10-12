import type { Generator } from '..';

// The hidden test generators of the set. Each one gets a seeded random() in [0, 1) and returns the inputs in the test format of the task:
// the edge cases of the statement first, then random medium inputs, then 2 inputs at the maximum constraint sizes.
type Random = () => number;

// An integer in [lo, hi].
const int = (random: Random, lo: number, hi: number): number => lo + Math.floor(random() * (hi - lo + 1));
const ints = (random: Random, n: number, lo: number, hi: number): number[] => Array.from({ length: n }, () => int(random, lo, hi));
// Fisher-Yates shuffle in place.
const shuffle = <T>(random: Random, list: T[]): T[] => { for (let i = list.length - 1; i > 0; i--) { const j = int(random, 0, i); [list[i], list[j]] = [list[j], list[i]]; } return list; };
// n different integers in [lo, hi] in random order.
const distinct = (random: Random, n: number, lo: number, hi: number): number[] => shuffle(random, Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)).slice(0, n);
// A string of n random characters of the alphabet.
const text = (random: Random, n: number, alphabet: string): string => Array.from({ length: n }, () => alphabet[int(random, 0, alphabet.length - 1)]).join('');
const repeat = <T>(times: number, make: () => T): T[] => Array.from({ length: times }, make);
// The Python literal of the call arguments: JSON is a Python literal for integers, lists and ASCII strings.
const call = (...args: unknown[]): string => JSON.stringify(args);
// The stdin text with one line for each row.
const lines = (rows: (string | number)[]): string => rows.join('\n') + '\n';

export default {
	'cf-1821-a': random => {
		const cases = (t: number, lo: number, hi: number): string => lines([t, ...repeat(t, () => text(random, int(random, lo, hi), '???0123456789'))]);
		return [
			'1\n?\n', '1\n0\n', '1\n?????\n', '1\n99999\n', '4\n0????\n00000\n0\n0?\n', '3\n10000\n?0000\n9\n',
			...repeat(6, () => cases(int(random, 2, 30), 1, 5)),
			cases(20000, 5, 5), cases(20000, 1, 5),
		];
	},
	'cf-1743-a': random => {
		const cases = (t: number, lo: number, hi: number): string => lines([t, ...repeat(t, () => { const n = int(random, lo, hi); return `${n}\n${distinct(random, n, 0, 9).sort((a, b) => a - b).join(' ')}`; })]);
		return [
			'1\n1\n0\n', '1\n1\n9\n', '1\n8\n0 1 2 3 4 5 6 7\n', '1\n8\n2 3 4 5 6 7 8 9\n', '2\n2\n0 9\n7\n1 2 3 4 5 6 7\n',
			...repeat(6, () => cases(int(random, 2, 20), 1, 8)),
			cases(200, 8, 8), cases(200, 1, 8),
		];
	},
	'cf-629-a': random => {
		// A cake of side n where each cell has a chocolate with the probability p.
		const cake = (n: number, p: number): string => lines([n, ...repeat(n, () => repeat(n, () => random() < p ? 'C' : '.').join(''))]);
		return [
			'1\n.\n', '1\nC\n', '2\nCC\nCC\n', '3\n...\n...\n...\n', '4\nCCCC\n....\n....\n....\n', '4\nC...\n.C..\n..C.\n...C\n',
			...repeat(6, () => cake(int(random, 2, 30), random())),
			cake(100, 1), cake(100, random()),
		];
	},
	'cf-1674-b': random => {
		const letters = [...'abcdefghijklmnopqrstuvwxyz'], words = letters.flatMap(a => letters.filter(b => b !== a).map(b => a + b));
		const cases = (list: string[]): string => lines([list.length, ...list]);
		return [
			'1\nab\n', '1\nzy\n', '1\naz\n', '1\nba\n', '1\nza\n', '2\nyz\nmn\n',
			...repeat(6, () => cases(repeat(int(random, 2, 30), () => words[int(random, 0, 649)]))),
			cases(shuffle(random, words.slice())), cases(repeat(650, () => words[int(random, 0, 649)])),
		];
	},
	'number-of-good-pairs': random => [
		call([1]), call([100]), call([7, 7]), call([1, 2]), call([100, 1, 100, 1, 100]), call(Array.from({ length: 100 }, (_, i) => i + 1)),
		...repeat(6, () => call(ints(random, int(random, 2, 60), 1, int(random, 2, 100)))),
		call(Array(100).fill(100)), call(ints(random, 100, 1, 100)),
	],
	'letter-case-permutation': random => {
		const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
		return [
			call('a'), call('Z'), call('7'), call('012345678901'), call('aB3'),
			...repeat(6, () => call(text(random, int(random, 2, 9), letters + '0123456789'))),
			call(text(random, 12, letters)), call(text(random, 12, letters)),
		];
	},
	subsets: random => [
		call([0]), call([-10]), call([10]), call([-10, 10]), call([1, 2, 3, 4]), call([5, 4, 3, 2, 1]),
		...repeat(6, () => call(distinct(random, int(random, 2, 8), -10, 10))),
		call(distinct(random, 10, -10, 10)), call(distinct(random, 10, -10, 10)),
	],
	permutations: random => [
		call([0]), call([-10]), call([10, -10]), call([1, 2, 3]), call([3, 2, 1]),
		...repeat(6, () => call(distinct(random, int(random, 2, 5), -10, 10))),
		call(distinct(random, 6, -10, 10)), call(distinct(random, 6, -10, 10)),
	],
	combinations: random => [
		call(1, 1), call(2, 1), call(2, 2), call(20, 1), call(20, 20), call(6, 6),
		...repeat(6, () => { const n = int(random, 3, 12); return call(n, int(random, 1, n)); }),
		// The answer for k from 6 to 15 is longer than the output limit of the judge (1,000,000 characters).
		call(20, 5), call(20, 16),
	],
	'letter-combinations-of-a-phone-number': random => [
		call('2'), call('7'), call('9'), call('22'), call('79'),
		...repeat(6, () => call(text(random, int(random, 2, 3), '23456789'))),
		call(text(random, 4, '23456789')), call(text(random, 4, '79')),
	],
	'subsets-ii': random => [
		call([0]), call([5, 5]), call([-10, -10, -10]), call([1, 2, 2]), call([3, 1, 2]), call([2, 1, 2, 1]), call(Array(10).fill(10)),
		...repeat(6, () => call(ints(random, int(random, 3, 8), -3, 3))),
		call(distinct(random, 10, -10, 10)), call(ints(random, 10, -10, 10)),
	],
	'permutations-ii': random => [
		call([0]), call([1, 1]), call([2, 2, 2]), call([1, 1, 2]), call([-10, 10]), call(Array(8).fill(-3)),
		...repeat(6, () => call(ints(random, int(random, 3, 6), -2, 2))),
		// 8 different values give 40,320 permutations, longer than the output limit of the judge (1,000,000 characters). One repeated value halves the count. 8 values in [-3, 3] always repeat a value.
		call(distinct(random, 7, -10, 10).flatMap((value, index) => index ? [value] : [value, value])), call(ints(random, 8, -3, 3)),
	],
	'combination-sum': random => {
		// The count of combinations with the sum target (coin change). The statement allows fewer than 150.
		const count = (candidates: number[], target: number): number => { const ways = [1, ...Array<number>(target).fill(0)]; for (const c of candidates) for (let s = c; s <= target; s++) ways[s] += ways[s - c]; return ways[target]; };
		// The largest target up to top with fewer than 150 combinations. The target 1 always fits, because each candidate is at least 2.
		const fit = (candidates: number[], top: number): string => { let target = top; while (count(candidates, target) >= 150) target--; return call(candidates, target); };
		return [
			call([2], 1), call([40], 40), call([2], 40), call([3], 40), call([39, 40], 1), call([2, 3], 7),
			...repeat(6, () => fit(distinct(random, int(random, 2, 10), 2, 20), int(random, 1, 40))),
			// The candidates 11 to 40 give 19 combinations for the target 40.
			call(distinct(random, 30, 11, 40), 40), fit(distinct(random, 30, 2, 40), 40),
		];
	},
	'generate-parentheses': random => [call(1), call(2), ...shuffle(random, [3, 4, 5, 6, 7]).map(n => call(n)), call(int(random, 3, 7)), call(8), call(8)],
	'cf-1097-b': random => {
		const turns = (angles: number[]): string => lines([angles.length, ...angles]);
		return [
			'1\n1\n', '1\n180\n', '2\n180\n180\n', '2\n90\n90\n', '4\n90\n90\n90\n90\n', '3\n120\n120\n120\n', '2\n1\n179\n',
			...repeat(6, () => turns(ints(random, int(random, 2, 10), 1, 180))),
			// 15 odd angles always give an odd sum, so the answer is NO after the full search.
			turns(ints(random, 15, 0, 89).map(a => 2 * a + 1)), turns(ints(random, 15, 1, 180)),
		];
	},
	'next-permutation': random => [
		call([0]), call([100]), call([1, 2]), call([2, 1]), call([5, 5, 5]), call([3, 2, 1]), call([1, 2, 3, 4, 5]), call([0, 100, 100, 0]),
		...repeat(6, () => call(ints(random, int(random, 3, 20), 0, int(random, 1, 100)))),
		call(ints(random, 100, 0, 100)), call(ints(random, 100, 0, 100).sort((a, b) => b - a)),
	],
	'unique-paths': random => {
		// C(m + n - 2, m - 1). The statement allows at most 2 · 10^9. Each step value C(n - 1 + i, i) is an integer below 2^53.
		const paths = (m: number, n: number): number => { let out = 1; for (let i = 1; i < m && out <= 2e9; i++) out = out * (n - 1 + i) / i; return out; };
		// A random n in [1, 100] with at most 2 · 10^9 paths for this m.
		const fit = (m: number): string => { let top = 100; while (paths(m, top) > 2e9) top--; return call(m, int(random, 1, top)); };
		return [
			call(1, 1), call(1, 100), call(100, 1), call(2, 2), call(2, 100), call(100, 2), call(17, 18), call(18, 17),
			...repeat(6, () => fit(int(random, 1, 100))),
			// C(105, 6) = 1609344100.
			call(100, 7), call(7, 100),
		];
	},
	'permutation-sequence': random => {
		const factorial = (n: number): number => n < 2 ? 1 : n * factorial(n - 1);
		const pick = (n: number): string => call(n, int(random, 1, factorial(n)));
		return [
			call(1, 1), call(2, 1), call(2, 2), call(3, 6), call(4, 24), call(9, 1), call(9, 362880),
			...repeat(6, () => pick(int(random, 3, 8))),
			pick(9), pick(9),
		];
	},
	'n-queens': random => [call(1), call(2), call(3), ...shuffle(random, [4, 5, 6, 7, 8]).map(n => call(n)), call(9), call(9)],
} satisfies Record<string, Generator>;
