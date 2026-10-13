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
} satisfies Record<string, Generator>;
