import type { Reference } from '..';
import { int, ints, need, reader, str } from '../constraints';

const distinct = (list: number[]): number[] => { need(new Set(list).size === list.length); return list; };
// A binary max-heap of numbers in an array: the children of place i are places 2i + 1 and 2i + 2.
const maxHeap = () => {
	const h: number[] = [];
	const push = (x: number): void => {
		let i = h.push(x) - 1;
		for (let parent = (i - 1) >> 1; i > 0 && h[parent] < x; i = parent, parent = (i - 1) >> 1) h[i] = h[parent];
		h[i] = x;
	};
	const pop = (): number => {
		const top = h[0], last = h.pop()!;
		if (!h.length) return top;
		let i = 0;
		for (let child = 1; child < h.length; i = child, child = 2 * i + 1) {
			if (child + 1 < h.length && h[child + 1] > h[child]) child++;
			if (h[child] <= last) break;
			h[i] = h[child];
		}
		h[i] = last;
		return top;
	};
	return { push, pop, size: (): number => h.length };
};
// For each right border r, the smallest left border l with max - min <= limit on a[l..r]. Two deques of indexes keep the maximum and the minimum of the window. O(n).
const lefts = (a: number[], limit: number): number[] => {
	const hi: number[] = [], lo: number[] = [], out: number[] = [];
	let l = 0, h = 0, m = 0;
	for (let r = 0; r < a.length; r++) {
		while (hi.length > h && a[hi[hi.length - 1]] <= a[r]) hi.pop();
		while (lo.length > m && a[lo[lo.length - 1]] >= a[r]) lo.pop();
		hi.push(r);
		lo.push(r);
		while (a[hi[h]] - a[lo[m]] > limit) { l++; if (hi[h] < l) h++; if (lo[m] < l) m++; }
		out.push(l);
	}
	return out;
};

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
	// O(n^2 log n) for n <= 30: smash the two heaviest stones and put the difference back in sorted order.
	'last-stone-weight': { mode: 'call', solve: (stones: unknown) => {
		const s = [...ints(stones, 1, 30, 1, 1000)].sort((a, b) => a - b);
		while (s.length > 1) { const y = s.pop()!, x = s.pop()!; if (y > x) { s.push(y - x); s.sort((a, b) => a - b); } }
		return s[0] ?? 0;
	} },
	// O(k n): k times multiply the first minimum.
	'final-array-state-after-k-multiplication-operations-i': { mode: 'call', solve: (nums: unknown, k: unknown, multiplier: unknown) => {
		const a = [...ints(nums, 1, 100, 1, 100)], times = int(k, 1, 10), m = int(multiplier, 1, 5);
		for (let t = 0; t < times; t++) a[a.indexOf(Math.min(...a))] *= m;
		return a;
	} },
	// O(n log n) for each test: keep the bonuses in a max-heap. A hero takes the largest bonus above it that is not used yet.
	'cf-1800-c2': { mode: 'stdio', solve: (stdin: string) => {
		const input = reader(stdin), out: string[] = [];
		let total = 0;
		for (let t = input.int(1, 1e4); t > 0; t--) {
			const n = input.int(1, 2e5), bonuses = maxHeap();
			total += n;
			need(total <= 2e5);
			let army = 0;
			for (let i = 0; i < n; i++) { const s = input.int(0, 1e9); if (s) bonuses.push(s); else if (bonuses.size()) army += bonuses.pop(); }
			out.push(String(army));
		}
		input.end();
		return out.join('\n') + '\n';
	} },
	// O(n log n): sort in descending order. The k-th largest counts the repeats.
	'kth-largest-element-in-an-array': { mode: 'call', solve: (nums: unknown, k: unknown) => {
		const a = ints(nums, 1, 1e5, -1e4, 1e4), at = int(k, 1, a.length);
		return [...a].sort((x, y) => y - x)[at - 1];
	} },
	// O(n log n): count the words, then sort by the count in descending order and by the word.
	'top-k-frequent-words': { mode: 'call', solve: (words: unknown, k: unknown) => {
		need(Array.isArray(words) && words.length >= 1 && words.length <= 500);
		const count = new Map<string, number>();
		for (const w of words) { const word = str(w, /^[a-z]{1,10}$/); count.set(word, (count.get(word) ?? 0) + 1); }
		const top = int(k, 1, count.size);
		return [...count].sort(([a, x], [b, y]) => y - x || (a < b ? -1 : 1)).slice(0, top).map(([word]) => word);
	} },
	// O(n): a deque of indexes with decreasing values. The back drops the values not greater than the new one, the front drops the index that left the window.
	'sliding-window-maximum': { mode: 'call', solve: (nums: unknown, k: unknown) => {
		const a = ints(nums, 1, 1e5, -1e4, 1e4), size = int(k, 1, a.length), dq: number[] = [], out: number[] = [];
		let head = 0;
		for (let i = 0; i < a.length; i++) {
			while (dq.length > head && a[dq[dq.length - 1]] <= a[i]) dq.pop();
			dq.push(i);
			if (dq[head] <= i - size) head++;
			if (i >= size - 1) out.push(a[dq[head]]);
		}
		return out;
	} },
	// O(n): the longest window r - l + 1 over the left borders of lefts.
	'longest-continuous-subarray-with-absolute-diff-less-than-or-equal-to-limit': { mode: 'call', solve: (nums: unknown, limit: unknown) => {
		const a = ints(nums, 1, 1e5, 1, 1e9);
		return lefts(a, int(limit, 0, 1e9)).reduce((best, l, r) => Math.max(best, r - l + 1), 0);
	} },
	// O(n): for each right border r, the subarrays l..r, ..., r..r fit, so add r - l + 1.
	'continuous-subarrays': { mode: 'call', solve: (nums: unknown) => lefts(ints(nums, 1, 1e5, 1, 1e9), 2).reduce((count, l, r) => count + r - l + 1, 0) },
	// O(n): a window with a deque of indexes for the maximum charge and the running sum of the costs. The left border moves while the cost is above the budget.
	'maximum-number-of-robots-within-budget': { mode: 'call', solve: (chargeTimes: unknown, runningCosts: unknown, budget: unknown) => {
		const charge = ints(chargeTimes, 1, 5e4, 1, 1e5), cost = ints(runningCosts, charge.length, charge.length, 1, 1e5), limit = int(budget, 1, 1e15), dq: number[] = [];
		let l = 0, head = 0, sum = 0, best = 0;
		for (let r = 0; r < charge.length; r++) {
			while (dq.length > head && charge[dq[dq.length - 1]] <= charge[r]) dq.pop();
			dq.push(r);
			sum += cost[r];
			while (l <= r && charge[dq[head]] + (r - l + 1) * sum > limit) { sum -= cost[l++]; if (dq[head] < l) head++; }
			best = Math.max(best, r - l + 1);
		}
		return best;
	} },
} satisfies Record<string, Reference>;
