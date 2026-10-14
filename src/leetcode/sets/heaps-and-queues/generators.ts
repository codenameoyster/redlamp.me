import type { Generator } from '..';

// The hidden tests of the set "heaps-and-queues". Each generator gives the edge cases of the statement, then random medium inputs, then the inputs at the maximum sizes.
// A call input is a Python literal list of the arguments. JSON of integers and lowercase words is a Python literal too.

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
// block writes a Codeforces array to stdin: the length is on one line, and the numbers are on the next line. A multi-test input starts with the count of the tests.
const block = (a: number[]): string => `${a.length}\n${a.join(' ')}\n`;
const tests = (blocks: string[]): string => `${blocks.length}\n${blocks.join('')}`;
// A random word of 1..10 lowercase letters.
const word = (random: Random): string => Array.from({ length: between(random, 1, 10) }, () => String.fromCharCode(between(random, 97, 122))).join('');
// n words from a vocabulary of `size` words, so the words repeat. The second argument k is from 1 to the number of unique words.
const words = (random: Random, n: number, size: number): unknown[] => {
	const vocabulary = Array.from({ length: size }, () => word(random)), list = Array.from({ length: n }, () => vocabulary[between(random, 0, size - 1)]);
	return [list, between(random, 1, new Set(list).size)];
};

// An n x n matrix with non-decreasing rows and columns: each value is the larger of its upper and left neighbours plus a random step from 0 to `step`. The largest value is start + (2n - 1) * step.
const sortedMatrix = (random: Random, n: number, start: number, step: number): number[][] => {
	const m: number[][] = [];
	for (let i = 0; i < n; i++) { m.push([]); for (let j = 0; j < n; j++) m[i].push(Math.max(i ? m[i - 1][j] : start, j ? m[i][j - 1] : start) + between(random, 0, step)); }
	return m;
};
// n tasks [enqueueTime, processingTime] with enqueue times in [1, last] and processing times in [1, longest].
const cpuTasks = (random: Random, n: number, last: number, longest: number): number[][] => Array.from({ length: n }, () => [between(random, 1, last), between(random, 1, longest)]);

export default {
	'time-needed-to-buy-tickets': (random: Random) => call([
		[[1], 0], [[100], 0], [[1, 100], 0], [[100, 1], 1], [[2, 3, 2], 2], [[5, 1, 1, 1], 0], [Array(100).fill(1), 99], [Array(100).fill(100), 0],
		...Array.from({ length: 4 }, () => { const n = between(random, 2, 60); return [list(random, n, 1, between(random, 1, 100)), between(random, 0, n - 1)]; }),
		[list(random, 100, 1, 100), between(random, 0, 99)], [Array(100).fill(100), 99],
	]),
	'number-of-students-unable-to-eat-lunch': (random: Random) => call([
		[[0], [0]], [[0], [1]], [[1], [1]], [[1], [0]], [[0, 1], [1, 0]], [[1, 1, 0, 0], [0, 1, 0, 1]], [[1, 0, 0, 0], [0, 0, 1, 1]], [[1, 1, 1, 0, 0, 1], [1, 0, 0, 0, 1, 1]],
		...Array.from({ length: 4 }, () => { const n = between(random, 2, 60); return [list(random, n, 0, 1), list(random, n, 0, 1)]; }),
		[list(random, 100, 0, 1), list(random, 100, 0, 1)], [Array(100).fill(1), Array(100).fill(0)],
	]),
	'cf-1579-e1': (random: Random) => {
		// The answer of n = 2 * 10^5 has about 1.3 million characters, more than the judge route accepts. n = 150000 gives about 940 thousand.
		// In the decreasing permutation each number goes to the front, so list.insert(0, x) makes about 1.1 * 10^10 moves.
		return [
			'1\n1\n1\n', '1\n2\n1 2\n', '1\n2\n2 1\n', '1\n5\n1 2 3 4 5\n', '1\n5\n5 4 3 2 1\n', '3\n4\n3 1 2 4\n1\n1\n6\n4 6 2 5 1 3\n',
			...Array.from({ length: 4 }, () => tests(Array.from({ length: between(random, 1, 5) }, () => block(permutation(random, between(random, 1, 30)))))),
			tests(Array.from({ length: 1000 }, () => block(permutation(random, 200)))), tests([block(permutation(random, 150000))]),
			tests([block(Array.from({ length: 150000 }, (_, i) => 150000 - i))]),
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
		// A card is a hero with the chance of one half, else a bonus up to hi.
		const deck = (n: number, hi: number): number[] => Array.from({ length: n }, () => random() < 0.5 ? 0 : between(random, 1, hi));
		return [
			'1\n1\n0\n', '1\n1\n1000000000\n', '1\n2\n0 5\n', '1\n2\n5 0\n', '1\n5\n0 0 0 0 0\n', '1\n6\n1000000000 1000000000 1000000000 0 0 0\n',
			...Array.from({ length: 4 }, () => tests(Array.from({ length: between(random, 1, 5) }, () => block(deck(between(random, 1, 30), between(random, 1, 1e9)))))),
			tests(Array.from({ length: 10000 }, () => block(deck(20, 1e9)))), tests([block(deck(200000, 1e9))]),
			// All bonuses come before all heroes: a scan of the unused bonuses for each hero reads about 5 * 10^9 numbers.
			tests([block([...list(random, 100000, 1, 1e9), ...Array(100000).fill(0)])]),
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
		// k = n / 2 makes a scan of each window cost 2.5 * 10^9 reads. In descending order the maximum leaves each window, so a new scan only when the maximum leaves costs the same.
		[list(random, 100000, -10000, 10000).sort((x, y) => y - x), 50000], [list(random, 100000, -10000, 10000), between(random, 1, 100000)],
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
	'kth-smallest-element-in-a-sorted-matrix': (random: Random) => call([
		[[[-5]], 1], [[[1000000000]], 1], [[[-1000000000]], 1], [[[1, 1], [1, 1]], 3], [[[1, 2], [3, 4]], 4], [[[-1000000000, 1000000000], [1000000000, 1000000000]], 1],
		...Array.from({ length: 4 }, () => { const n = between(random, 2, 40); return [sortedMatrix(random, n, between(random, -50, 50), between(random, 0, 3)), between(random, 1, n * n)]; }),
		// 599 steps of at most 3338898 keep the values in [-10^9, 10^9].
		[sortedMatrix(random, 300, -1000000000, 3338898), between(random, 1, 90000)], [sortedMatrix(random, 300, 0, 1), 45000],
	]),
	'maximum-subsequence-score': (random: Random) => call([
		[[0], [0], 1], [[100000], [100000], 1], [[1, 2], [2, 1], 2], [[0, 0, 0], [1, 2, 3], 2], [[3, 3, 3], [3, 3, 3], 3], [[9, 1, 1], [1, 9, 9], 2],
		...Array.from({ length: 4 }, () => { const n = between(random, 2, 60), hi = between(random, 1, 100000); return [list(random, n, 0, hi), list(random, n, 0, hi), between(random, 1, n)]; }),
		// A new sum(h) on each step with k numbers in the heap reads about 2.5 * 10^9 numbers for k = n / 2. The second input has many equal nums2.
		[list(random, 100000, 0, 100000), list(random, 100000, 0, 100000), 50000], [list(random, 100000, 0, 100000), list(random, 100000, 1, 10), 70000],
	]),
	'cf-1526-c2': (random: Random) => [
		'1\n0\n', '1\n-1000000000\n', '1\n1000000000\n', '2\n-1 1\n', '2\n1 -1\n', '5\n-1 -2 -3 -4 -5\n', '3\n1000000000 -1000000000 -1000000000\n',
		...Array.from({ length: 4 }, () => block(list(random, between(random, 2, 60), -20, 20))),
		// The pattern 2, -2, -2 drops one potion in each three, and the drunk list grows by two: a scan of the list for the worst potion reads about 4 * 10^9 numbers.
		block(list(random, 200000, -1000000000, 1000000000)), block(Array.from({ length: 200000 }, (_, i) => i % 3 ? -2 : 2)),
	],
	'single-threaded-cpu': (random: Random) => call([
		[[[1, 1]]], [[[1000000000, 1000000000]]], [[[1, 5], [1, 5], [1, 5]]], [[[5, 1], [1, 10]]], [[[1, 1], [1000000000, 1]]], [[[2, 3], [1, 3], [2, 1]]],
		...Array.from({ length: 2 }, () => [cpuTasks(random, between(random, 2, 60), 30, 10)]),
		...Array.from({ length: 2 }, () => [cpuTasks(random, between(random, 2, 60), 1000, 20)]),
		// All tasks arrive at 1: a scan of the arrived tasks on each step costs about 5 * 10^9 reads. Arrivals up to 10^9 leave idle gaps: a clock that steps by 1 makes about 5 * 10^8 idle steps.
		[cpuTasks(random, 100000, 1, 10)], [cpuTasks(random, 100000, 1000000000, 10000)],
	]),
	'total-cost-to-hire-k-workers': (random: Random) => call([
		[[1], 1, 1], [[100000], 1, 1], [[1, 2], 2, 1], [[2, 1], 1, 1], [[3, 2, 7, 7, 1, 2], 2, 2], [[1, 1, 1, 1], 4, 4], [[5, 4, 3, 2, 1], 5, 1], [[1, 2], 2, 2],
		// In the first input both windows hold a 3: the tie rule hires worker 0, and then the 1 enters the left window. The answer is 4, the sum of the k cheapest costs is 3, and a tie to the right group gives 5.
		// In the second input the windows hold [2, 2] and [2, 3]: a tie to the right group gives 4, and the answer is 3.
		[[3, 1, 2, 3], 2, 1], [[2, 2, 1, 3, 3, 2], 2, 2],
		...Array.from({ length: 4 }, () => { const n = between(random, 2, 60); return [list(random, n, 1, 20), between(random, 1, n), between(random, 1, n)]; }),
		// A scan of both groups on each hire costs about 3.75 * 10^9 reads on each of the two inputs. The second input has 2 * candidates = n, so the groups meet at once.
		[list(random, 100000, 1, 100000), 100000, 25000], [list(random, 100000, 1, 10), 50000, 50000],
	]),
} satisfies Record<string, Generator>;
