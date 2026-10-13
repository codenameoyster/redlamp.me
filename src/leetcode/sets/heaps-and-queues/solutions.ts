import type { Reference } from '..';
import { int, ints, need, reader } from '../constraints';

const distinct = (list: number[]): number[] => { need(new Set(list).size === list.length); return list; };

export default {
	// O(n): before person k ends, a person in front of k or k buys min(tickets[i], tickets[k]) tickets, and a person after k buys one ticket less.
	'time-needed-to-buy-tickets': { mode: 'call', solve: (tickets: unknown, k: unknown) => {
		const t = ints(tickets, 1, 100, 1, 100), at = int(k, 0, t.length - 1);
		return t.reduce((time, x, i) => time + Math.min(x, i <= at ? t[at] : t[at] - 1), 0);
	} },
	// O(n): the queue order does not matter, only the count of each kind. The line stops at the first sandwich that no student wants.
	'number-of-students-unable-to-eat-lunch': { mode: 'call', solve: (students: unknown, sandwiches: unknown) => {
		const s = ints(students, 1, 100, 0, 1), w = ints(sandwiches, s.length, s.length, 0, 1), want = [0, 0];
		for (const x of s) want[x]++;
		for (let i = 0; i < w.length; i++) { if (!want[w[i]]) return w.length - i; want[w[i]]--; }
		return 0;
	} },
	// O(n) for each test: a number smaller than the first number of the deque goes to the front, any other number goes to the back.
	'cf-1579-e1': { mode: 'stdio', solve: (stdin: string) => {
		const input = reader(stdin), out: string[] = [];
		let total = 0;
		for (let t = input.int(1, 1000); t > 0; t--) {
			const n = input.int(1, 2e5), seen = new Uint8Array(n + 1), front: number[] = [], back: number[] = [];
			total += n;
			need(total <= 2e5);
			let first = Infinity;
			for (let i = 0; i < n; i++) {
				const x = input.int(1, n);
				need(!seen[x]);
				seen[x] = 1;
				if (x < first) { front.push(x); first = x; } else back.push(x);
			}
			out.push(front.reverse().concat(back).join(' '));
		}
		input.end();
		return out.join('\n') + '\n';
	} },
	// O(n): the Josephus recurrence. The winner place among m friends is (the winner place among m - 1 friends + k) mod m.
	'find-the-winner-of-the-circular-game': { mode: 'call', solve: (n: unknown, k: unknown) => {
		const m = int(n, 1, 500), step = int(k, 1, m);
		let winner = 0;
		for (let size = 2; size <= m; size++) winner = (winner + step) % size;
		return winner + 1;
	} },
	// O(n log n): sort, then repeat the reveal on a queue of the places. The next smallest card goes to the place that opens next.
	'reveal-cards-in-increasing-order': { mode: 'call', solve: (deck: unknown) => {
		const d = distinct(ints(deck, 1, 1000, 1, 1e6)), places = Array.from(d, (_, i) => i), out: number[] = [];
		let head = 0;
		for (const x of [...d].sort((a, b) => a - b)) { out[places[head++]] = x; if (head < places.length) places.push(places[head++]); }
		return out;
	} },
} satisfies Record<string, Reference>;
