import type { Reference } from '..';
import { int, ints, need, reader, str } from '../constraints';

const sorted = (list: number[]): number[] => { need(list.every((value, index) => !index || list[index - 1] <= value)); return list; };

export default {
	// Expected O(n) time and O(n) storage for uniqueness validation. Two Pointers then uses constant auxiliary state.
	'two-sum-ii-input-array-is-sorted': { mode: 'call', solve: (numbers: unknown, target: unknown) => {
		const a = sorted(ints(numbers, 2, 3e4, -1000, 1000)), t = int(target, -1000, 1000), seen = new Map<number, number>();
		let pairs = 0, l = 0, r = a.length - 1;
		for (const x of a) { pairs += seen.get(t - x) ?? 0; seen.set(x, (seen.get(x) ?? 0) + 1); }
		need(pairs === 1);
		while (a[l] + a[r] !== t) if (a[l] + a[r] < t) l++; else r--;
		return [l + 1, r + 1];
	} },
	// O(n): l and r skip the characters that are not letters or digits and compare the rest without case.
	'valid-palindrome': { mode: 'call', solve: (s: unknown) => {
		const t = str(s, /^[\x20-\x7e]{1,200000}$/), alnum = (c: number) => c >= 48 && c <= 57 || c >= 65 && c <= 90 || c >= 97 && c <= 122, low = (c: number) => c >= 65 && c <= 90 ? c + 32 : c;
		let l = 0, r = t.length - 1;
		while (l < r) if (!alnum(t.charCodeAt(l))) l++; else if (!alnum(t.charCodeAt(r))) r--; else if (low(t.charCodeAt(l++)) !== low(t.charCodeAt(r--))) return false;
		return true;
	} },
	// Expected O(n) time: a Hash Table keeps the numbers that wait for a pair.
	'max-number-of-k-sum-pairs': { mode: 'call', solve: (nums: unknown, k: unknown) => {
		const a = ints(nums, 1, 1e5, 1, 1e9), sum = int(k, 1, 1e9), wait = new Map<number, number>();
		let ops = 0;
		for (const x of a) { const c = wait.get(sum - x) ?? 0; if (c) { wait.set(sum - x, c - 1); ops++; } else wait.set(x, (wait.get(x) ?? 0) + 1); }
		return ops;
	} },
	// O(n): move the lower line, because no narrower pair with it holds more water.
	'container-with-most-water': { mode: 'call', solve: (height: unknown) => {
		const h = ints(height, 2, 1e5, 0, 1e4);
		let l = 0, r = h.length - 1, best = 0;
		while (l < r) { best = Math.max(best, Math.min(h[l], h[r]) * (r - l)); if (h[l] < h[r]) l++; else r--; }
		return best;
	} },
	// O(n log n): sort, then the heaviest person takes the lightest person when the pair fits.
	'boats-to-save-people': { mode: 'call', solve: (people: unknown, limit: unknown) => {
		const lim = int(limit, 1, 3e4), p = Int32Array.from(ints(people, 1, 5e4, 1, lim)).sort();
		let l = 0, boats = 0;
		for (let r = p.length - 1; l <= r; r--, boats++) if (p[l] + p[r] <= lim) l++;
		return boats;
	} },
	// O(n) time and O(1) scan state. The returned prefix copy stores k output entries.
	'remove-duplicates-from-sorted-array': { mode: 'call', solve: (nums: unknown) => {
		const a = sorted(ints(nums, 1, 3e4, -100, 100));
		let k = 1;
		for (let i = 1; i < a.length; i++) if (a[i] !== a[k - 1]) a[k++] = a[i];
		return a.slice(0, k);
	} },
	// O(n) time and O(1) scan state. The returned prefix copy stores k output entries.
	'remove-element': { mode: 'call', solve: (nums: unknown, val: unknown) => {
		const a = ints(nums, 0, 100, 0, 50), v = int(val, 0, 100);
		let k = 0;
		for (let i = 0; i < a.length; i++) if (a[i] !== v) a[k++] = a[i];
		return a.slice(0, k);
	} },
	// O(n): the write pointer keeps the values that are not zero in order, and zeros fill the tail.
	'move-zeroes': { mode: 'call', solve: (nums: unknown) => {
		const a = ints(nums, 1, 1e4, -(2 ** 31), 2 ** 31 - 1);
		let k = 0;
		for (let i = 0; i < a.length; i++) if (a[i] !== 0) a[k++] = a[i];
		return a.fill(0, k);
	} },
	// O(n) time and O(1) scan state. The returned prefix copy stores k output entries.
	'remove-duplicates-from-sorted-array-ii': { mode: 'call', solve: (nums: unknown) => {
		const a = sorted(ints(nums, 1, 3e4, -1e4, 1e4));
		let k = 0;
		for (let i = 0; i < a.length; i++) if (k < 2 || a[i] !== a[k - 2]) a[k++] = a[i];
		return a.slice(0, k);
	} },
	// O(n) in one pass: the Dutch national flag partition with three pointers.
	'sort-colors': { mode: 'call', solve: (nums: unknown) => {
		const a = ints(nums, 1, 300, 0, 2);
		let lo = 0, mid = 0, hi = a.length - 1;
		while (mid <= hi) {
			if (a[mid] === 0) { [a[lo], a[mid]] = [a[mid], a[lo]]; lo++; mid++; }
			else if (a[mid] === 1) mid++;
			else { [a[mid], a[hi]] = [a[hi], a[mid]]; hi--; }
		}
		return a;
	} },
	// O(m + n) time. Validation slices use O(m + n) temporary entries; the backward Merge uses O(1) auxiliary state.
	'merge-sorted-array': { mode: 'call', solve: (nums1: unknown, m: unknown, nums2: unknown, n: unknown) => {
		const mm = int(m, 0, 200), nn = int(n, 0, 200);
		need(mm + nn >= 1 && mm + nn <= 200);
		const a = ints(nums1, mm + nn, mm + nn, -1e9, 1e9), b = sorted(ints(nums2, nn, nn, -1e9, 1e9));
		sorted(a.slice(0, mm));
		// The statement puts zeros into the last n places of nums1.
		need(a.slice(mm).every(x => x === 0));
		let i = mm - 1, j = nn - 1;
		for (let w = mm + nn - 1; j >= 0; w--) a[w] = i >= 0 && a[i] > b[j] ? a[i--] : b[j--];
		return a;
	} },
	// O(|t|): one pass over t moves the pointer in s on each match.
	'is-subsequence': { mode: 'call', solve: (s: unknown, t: unknown) => {
		const sub = str(s, /^[a-z]{0,100}$/), text = str(t, /^[a-z]{0,10000}$/);
		let i = 0;
		for (let j = 0; j < text.length && i < sub.length; j++) if (text[j] === sub[i]) i++;
		return i === sub.length;
	} },
	// O(n + m) append operations and output characters. String-copy costs depend on the engine.
	'merge-strings-alternately': { mode: 'call', solve: (word1: unknown, word2: unknown) => {
		const a = str(word1, /^[a-z]{1,100}$/), b = str(word2, /^[a-z]{1,100}$/);
		let out = '';
		for (let i = 0; i < Math.max(a.length, b.length); i++) out += (a[i] ?? '') + (b[i] ?? '');
		return out;
	} },
	// Expected O(n + m) time: a Hash Table of nums2 filters the unique values of nums1.
	'intersection-of-two-arrays': { mode: 'call', solve: (nums1: unknown, nums2: unknown) => {
		const a = ints(nums1, 1, 1000, 0, 1000), b = new Set(ints(nums2, 1, 1000, 0, 1000));
		return [...new Set(a)].filter(x => b.has(x));
	} },
	// O(n log n) for each test: sort, then count the pairs with a sum at most r minus the pairs with a sum at most l - 1, each with two pointers.
	'cf-1538-c': { mode: 'stdio', solve: (stdin: string) => {
		const input = reader(stdin), out: number[] = [];
		let total = 0;
		for (let t = input.int(1, 1e4); t > 0; t--) {
			const n = input.int(1, 2e5), l = input.int(1, 1e9), r = input.int(l, 1e9);
			total += n;
			need(total <= 2e5);
			const a = new Float64Array(n);
			for (let i = 0; i < n; i++) a[i] = input.int(1, 1e9);
			a.sort();
			const atMost = (x: number) => { let c = 0; for (let i = 0, j = n - 1; i < j; i++) { while (i < j && a[i] + a[j] > x) j--; c += j - i; } return c; };
			out.push(atMost(r) - atMost(l - 1));
		}
		input.end();
		return out.join('\n') + '\n';
	} },
	// O(n^2): sort, fix the first value, two pointers find the other two values, and equal values are skipped.
	'3sum': { mode: 'call', solve: (nums: unknown) => {
		const a = Int32Array.from(ints(nums, 3, 3000, -1e5, 1e5)).sort(), out: number[][] = [];
		for (let i = 0; i < a.length - 2 && a[i] <= 0; i++) {
			if (i > 0 && a[i] === a[i - 1]) continue;
			for (let l = i + 1, r = a.length - 1; l < r;) {
				const s = a[i] + a[l] + a[r];
				if (s < 0) l++;
				else if (s > 0) r--;
				else { out.push([a[i], a[l], a[r]]); do l++; while (l < r && a[l] === a[l - 1]); r--; }
			}
		}
		return out;
	} },
	// O(n) time and storage for the copied input and output. Each group gives its character and the digits of its length.
	'string-compression': { mode: 'call', solve: (chars: unknown) => {
		need(Array.isArray(chars) && chars.length >= 1 && chars.length <= 2000);
		const a = chars.map(char => str(char, /^[\x20-\x7e]$/)), out: string[] = [];
		for (let i = 0, j = 0; i < a.length; i = j) { while (a[j] === a[i]) j++; out.push(a[i], ...(j - i > 1 ? String(j - i) : '')); }
		return out;
	} },
} satisfies Record<string, Reference>;
