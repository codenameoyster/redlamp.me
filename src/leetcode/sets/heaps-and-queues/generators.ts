import type { Generator } from '..';

// The hidden tests of the set "heaps-and-queues". Each generator gives the edge cases of the statement, then random medium inputs, then 2 inputs at the maximum sizes.
// A call input is a Python literal list of the arguments. JSON of integers is a Python literal too.

type Random = () => number;

// A random integer in [lo, hi].
const between = (random: Random, lo: number, hi: number): number => lo + Math.floor(random() * (hi - lo + 1));
const list = (random: Random, n: number, lo: number, hi: number): number[] => Array.from({ length: n }, () => between(random, lo, hi));
// The numbers 1..n in a random order (Fisher-Yates).
const permutation = (random: Random, n: number): number[] => {
	const p = Array.from({ length: n }, (_, i) => i + 1);
	for (let i = n - 1; i > 0; i--) { const j = between(random, 0, i); [p[i], p[j]] = [p[j], p[i]]; }
	return p;
};
// n different random integers in [lo, hi].
const distinct = (random: Random, n: number, lo: number, hi: number): number[] => {
	const seen = new Set<number>();
	while (seen.size < n) seen.add(between(random, lo, hi));
	return [...seen];
};
const call = (cases: unknown[][]): string[] => cases.map(args => JSON.stringify(args));
// A random word of 1..10 lowercase letters.
const word = (random: Random): string => Array.from({ length: between(random, 1, 10) }, () => String.fromCharCode(between(random, 97, 122))).join('');
// n words from a vocabulary of `size` words, so the words repeat. The second argument k is from 1 to the number of unique words.
const words = (random: Random, n: number, size: number): unknown[] => {
	const vocabulary = Array.from({ length: size }, () => word(random)), list = Array.from({ length: n }, () => vocabulary[between(random, 0, size - 1)]);
	return [list, between(random, 1, new Set(list).size)];
};

export default {
	'time-needed-to-buy-tickets': (random: Random) => call([
		[[1], 0], [[100], 0], [[1, 100], 0], [[100, 1], 1], [[2, 3, 2], 2], [[5, 1, 1, 1], 0], [Array(100).fill(1), 99], [Array(100).fill(100), 0],
		...Array.from({ length: 4 }, () => { const n = between(random, 2, 60); return [list(random, n, 1, between(random, 1, 100)), between(random, 0, n - 1)]; }),
		[list(random, 100, 1, 100), between(random, 0, 99)], [Array(100).fill(100), 99],
	]),
	'number-of-students-unable-to-eat-lunch': (random: Random) => call([
		[[0], [0]], [[0], [1]], [[1], [1]], [[1], [0]], [[0, 1], [1, 0]], [[1, 1, 0, 0], [0, 1, 0, 1]], [[0, 0, 1], [1, 1, 0]], [[1, 1, 1, 0, 0, 1], [1, 0, 0, 0, 1, 1]],
		...Array.from({ length: 4 }, () => { const n = between(random, 2, 60); return [list(random, n, 0, 1), list(random, n, 0, 1)]; }),
		[list(random, 100, 0, 1), list(random, 100, 0, 1)], [Array(100).fill(1), Array(100).fill(0)],
	]),
	'cf-1579-e1': (random: Random) => {
		const block = (p: number[]): string => `${p.length}\n${p.join(' ')}\n`;
		const input = (blocks: string[]): string => `${blocks.length}\n${blocks.join('')}`;
		// The answer of n = 2 * 10^5 has about 1.3 million characters, more than the judge route accepts. n = 150000 gives about 940 thousand.
		return [
			'1\n1\n1\n', '1\n2\n1 2\n', '1\n2\n2 1\n', '1\n5\n1 2 3 4 5\n', '1\n5\n5 4 3 2 1\n', '3\n4\n3 1 2 4\n1\n1\n6\n4 6 2 5 1 3\n',
			...Array.from({ length: 4 }, () => input(Array.from({ length: between(random, 1, 5) }, () => block(permutation(random, between(random, 1, 30)))))),
			input(Array.from({ length: 1000 }, () => block(permutation(random, 200)))), input([block(permutation(random, 150000))]),
		];
	},
	'find-the-winner-of-the-circular-game': (random: Random) => call([
		[1, 1], [2, 1], [2, 2], [5, 2], [6, 5], [500, 1], [500, 500],
		...Array.from({ length: 4 }, () => { const n = between(random, 2, 60); return [n, between(random, 1, n)]; }),
		[500, between(random, 2, 499)], [500, 499],
	]),
	'reveal-cards-in-increasing-order': (random: Random) => call([
		[[1]], [[1000000]], [[1, 1000000]], [[1000000, 1]], [[1, 2, 3, 4]], [[17, 13, 11, 2, 3, 5, 7]],
		...Array.from({ length: 4 }, () => [distinct(random, between(random, 2, 60), 1, between(random, 60, 1000000))]),
		[distinct(random, 1000, 1, 1000000)], [permutation(random, 1000)],
	]),
	'last-stone-weight': (random: Random) => call([
		[[1]], [[1000]], [[1, 1]], [[1000, 1]], [[2, 2, 2]], [[5, 3, 2]], [Array(30).fill(1000)], [Array.from({ length: 30 }, (_, i) => i + 1)],
		...Array.from({ length: 4 }, () => [list(random, between(random, 2, 20), 1, between(random, 2, 1000))]),
		[list(random, 30, 1, 1000)], [list(random, 30, 990, 1000)],
	]),
	'final-array-state-after-k-multiplication-operations-i': (random: Random) => call([
		[[1], 1, 1], [[100], 10, 5], [[1, 1], 10, 2], [[7, 7, 7], 2, 3], [[2, 1, 3], 10, 1], [[100, 1], 10, 5], [Array(100).fill(1), 10, 5],
		...Array.from({ length: 4 }, () => [list(random, between(random, 2, 60), 1, between(random, 2, 100)), between(random, 1, 10), between(random, 1, 5)]),
		[list(random, 100, 1, 100), 10, between(random, 2, 5)], [Array(100).fill(100), 10, 5],
	]),
	'cf-1800-c2': (random: Random) => {
		const block = (s: number[]): string => `${s.length}\n${s.join(' ')}\n`;
		const input = (blocks: string[]): string => `${blocks.length}\n${blocks.join('')}`;
		// A card is a hero with the chance of one half, else a bonus up to hi.
		const deck = (n: number, hi: number): number[] => Array.from({ length: n }, () => random() < 0.5 ? 0 : between(random, 1, hi));
		return [
			'1\n1\n0\n', '1\n1\n1000000000\n', '1\n2\n0 5\n', '1\n2\n5 0\n', '1\n5\n0 0 0 0 0\n', '1\n6\n1000000000 1000000000 1000000000 0 0 0\n',
			...Array.from({ length: 4 }, () => input(Array.from({ length: between(random, 1, 5) }, () => block(deck(between(random, 1, 30), between(random, 1, 1e9)))))),
			input(Array.from({ length: 10000 }, () => block(deck(20, 1e9)))), input([block(deck(200000, 1e9))]),
		];
	},
	'kth-largest-element-in-an-array': (random: Random) => call([
		[[1], 1], [[-10000], 1], [[10000, -10000], 1], [[10000, -10000], 2], [[5, 5, 5], 2], [[1, 2, 3, 4, 5], 5],
		...Array.from({ length: 4 }, () => { const n = between(random, 2, 60); return [list(random, n, -between(random, 0, 20), between(random, 0, 20)), between(random, 1, n)]; }),
		[list(random, 100000, -10000, 10000), between(random, 1, 100000)], [list(random, 100000, -3, 3), between(random, 1, 100000)],
	]),
	'top-k-frequent-words': (random: Random) => call([
		[['a'], 1], [['abcdefghij'], 1], [['b', 'a'], 2], [['a', 'aa', 'a', 'aa', 'b'], 2], [['z', 'y', 'x', 'y'], 3], [Array(500).fill('word'), 1],
		...Array.from({ length: 4 }, () => words(random, between(random, 2, 60), between(random, 1, 15))),
		words(random, 500, 50), words(random, 500, 500),
	]),
	'sliding-window-maximum': (random: Random) => call([
		[[1], 1], [[-10000], 1], [[10000, -10000], 1], [[10000, -10000], 2], [[5, 5, 5, 5], 2], [[1, 2, 3, 4, 5], 3], [[5, 4, 3, 2, 1], 3],
		...Array.from({ length: 4 }, () => { const n = between(random, 2, 60); return [list(random, n, -between(random, 0, 20), between(random, 0, 20)), between(random, 1, n)]; }),
		// k = n / 2 makes a scan of each window cost 2.5 * 10^9 reads.
		[list(random, 100000, -10000, 10000), 50000], [list(random, 100000, -10000, 10000), between(random, 1, 100000)],
	]),
	'longest-continuous-subarray-with-absolute-diff-less-than-or-equal-to-limit': (random: Random) => call([
		[[1], 0], [[1000000000], 1000000000], [[1, 1000000000], 999999999], [[1, 1000000000], 999999998], [[7, 7, 7, 7], 0], [[1, 2, 1, 2], 0], [[5, 1, 5, 1], 4],
		...Array.from({ length: 4 }, () => [list(random, between(random, 2, 60), 1, between(random, 2, 30)), between(random, 0, 10)]),
		[list(random, 100000, 1, 1000000000), between(random, 0, 1000000000)], [list(random, 100000, 1, 10), 9],
	]),
	'continuous-subarrays': (random: Random) => call([
		[[1]], [[1000000000]], [[1, 3]], [[1, 4]], [[2, 2, 2, 2]], [[1, 1000000000, 1]],
		...Array.from({ length: 4 }, () => [list(random, between(random, 2, 60), 1, between(random, 3, 8))]),
		// Values in a range of 2 make every subarray continuous: 100000 * 100001 / 2 = 5000050000.
		[list(random, 100000, 1, 1000000000)], [list(random, 100000, 999999998, 1000000000)],
	]),
	'maximum-number-of-robots-within-budget': (random: Random) => call([
		[[1], [1], 1], [[1], [1], 2], [[100000], [100000], 1000000000000000], [[3, 1], [1, 1], 4], [[1, 1, 1, 1], [1, 1, 1, 1], 17], [[10, 1, 1, 1], [1, 1, 1, 1], 13],
		...Array.from({ length: 4 }, () => { const n = between(random, 2, 60); return [list(random, n, 1, 100000), list(random, n, 1, 100000), between(random, 1, 100000 + n * n * 100000)]; }),
		[list(random, 50000, 1, 100000), list(random, 50000, 1, 100000), between(random, 1e9, 1e12)], [Array(50000).fill(100000), Array(50000).fill(100000), 1000000000000000],
	]),
} satisfies Record<string, Generator>;
