import { globSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { loadPyodide } from 'pyodide';

const expectedSamples = [
	{ name: 'permutations-and-combinations/chapter1 sample 1', output: '12\n' },
	{ name: 'permutations-and-combinations/chapter1 sample 2', output: '120\n' },
	{ name: 'permutations-and-combinations/chapter1 sample 3', output: '10\n120 120\n' },
	{ name: 'permutations-and-combinations/chapter2 sample 1', output: '[[], [1], [1, 2], [1, 2, 3], [1, 3], [2], [2, 3], [3]]\n' },
	{ name: 'permutations-and-combinations/chapter2 sample 2', output: '[[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]]\n' },
	{ name: 'permutations-and-combinations/chapter2 sample 3', output: '[[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]]\n' },
	{ name: 'permutations-and-combinations/chapter2 sample 4', output: "['ad', 'ae', 'af', 'bd', 'be', 'bf', 'cd', 'ce', 'cf']\n" },
	{ name: 'permutations-and-combinations/chapter3 sample 1', output: '[[2, 2, 3], [7]]\n' },
	{ name: 'permutations-and-combinations/chapter3 sample 2', output: "['((()))', '(()())', '(())()', '()(())', '()()()']\n" },
	{ name: 'permutations-and-combinations/chapter3 sample 3', output: 'YES\n' },
	{ name: 'permutations-and-combinations/chapter4 sample 1', output: '[1, 3, 2, 4, 5]\n' },
	{ name: 'permutations-and-combinations/chapter4 sample 2', output: '6\n' },
	{ name: 'permutations-and-combinations/chapter4 sample 3', output: '2314\n' },
	{ name: 'permutations-and-combinations/chapter4 sample 4', output: '[[1, 3, 0, 2], [2, 0, 3, 1]]\n' },
	{ name: 'two-pointers/chapter1 sample 1', output: '[3, 5]\n' },
	{ name: 'two-pointers/chapter3 sample 1', output: '[1, 2, 3, 3, 5, 6, 7, 8, 9]\n' },
	{ name: 'heaps-and-queues/chapter1 sample 1', output: '5\n8\n' },
	{ name: 'heaps-and-queues/chapter1 sample 2', output: '5\n1\n' },
	{ name: 'heaps-and-queues/chapter1 sample 3', output: '6\n' },
	{ name: 'heaps-and-queues/chapter1 sample 4', output: '3\n' },
	{ name: 'heaps-and-queues/chapter2 sample 1', output: '[0, 3, 1, 5, 9, 8, 2]\n0\n[1, 3, 2, 5, 9, 8]\n' },
	{ name: 'heaps-and-queues/chapter2 sample 2', output: '[-9, -4, -6]\n9 9 [-6, -4]\n' },
	{ name: 'heaps-and-queues/chapter2 sample 3', output: '[-1]\n' },
	{ name: 'heaps-and-queues/chapter3 sample 1', output: '[7, 7, 5, 5, 6, 6]\n' },
	{ name: 'heaps-and-queues/chapter4 sample 1', output: '[1, 2, 3, 4, 5, 6, 7, 9, 10]\n' },
	{ name: 'starter code of a Codeforces task', output: '0\n0\n' },
];

// Each lesson sample with a run button runs through web/harness.py, as the button runs it. Workers do not allow WebAssembly.compile, so this check runs in Node and not in vitest. https://developers.cloudflare.com/workers/runtime-apis/web-standards/#javascript-standards
// The test opens no page, so it needs no server and no browser.
const root = 'src/leetcode/sets', entities: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', '#39': "'" };
const lessons = globSync(`${root}/*/chapter*.html`).flatMap(path => {
	const html = readFileSync(path, 'utf8');
	// The rule of the button: code.language-python in a <pre> without the class no-run.
	return [...html.matchAll(/<pre(?![^>]*\bno-run\b)[^>]*><code class="language-python">([\s\S]*?)<\/code>/g)].map((match, index) => ({ name: `${path.slice(root.length + 1, -5)} sample ${index + 1}`, code: match[1].replace(/&(lt|gt|amp|quot|#39);/g, (_, name: string) => entities[name]), input: '' }));
});
// The starter code of a Codeforces task is a function for one test, called once for each test. The placeholder returns 0.
const starter = 'def ans():\n    N = int(input())\n    a = list(map(int, input().split()))\n    # Посчитайте ответ и верните его.\n    return 0\n\nt = int(input())\na = [ans() for _ in range(t)]\nfor res in a:\n    print(res)\n';
const samples = [...lessons, { name: 'starter code of a Codeforces task', code: starter, input: '2\n3\n1 2 3\n1\n5\n' }];

let run: Promise<(code: string, spec: string, test: string) => string> | undefined;
async function runSample(code: string, input = ''): Promise<string> {
	run ??= loadPyodide({ indexURL: 'node_modules/pyodide/' }).then(python => {
		python.runPython(readFileSync('web/harness.py', 'utf8'));
		// A Pyodide call blocks Node, so the test time limit cannot stop a sample that does not end. The trace stops it after 2 s. A loop inside C code calls no trace and does not stop.
		python.runPython(`import time
def timed(*args):
    end = time.monotonic() + 2
    def trace(*_):
        if time.monotonic() > end:
            raise TimeoutError('the sample runs longer than 2 s')
        return trace
    sys.settrace(trace)
    try:
        return run(*args)
    finally:
        sys.settrace(None)`);
		return python.globals.get('timed');
	});
	const result = JSON.parse((await run)(code, JSON.stringify({ mode: 'stdio' }), JSON.stringify({ input, expected: null }))) as { output: string; error: { message: string; line: number | null } | null };
	expect(result.error).toBeNull();
	return result.output;
}

test('every reviewed sample remains runnable', () => {
	expect(samples.map(sample => sample.name).sort()).toEqual(expectedSamples.map(sample => sample.name).sort());
});

for (const sample of samples) {
	test(sample.name, async () => {
		const expected = expectedSamples.find(item => item.name === sample.name);
		expect(expected, `Add a reviewed expected output for ${sample.name}`).toBeDefined();
		expect(await runSample(sample.code, sample.input)).toBe(expected?.output);
	});
}

const countCases = [
	{
		name: 'Subsets copies each of three values into four answers', sample: 'permutations-and-combinations/chapter2 sample 1',
		replacements: [['res.append(path[:])', '_record("answers", res.append(_record("copied entries", path[:], len(path))))']],
		expected: { answers: 8, 'copied entries': 12 },
	},
	{
		name: 'Permutations checks three candidates at each of ten non-leaf calls', sample: 'permutations-and-combinations/chapter2 sample 2',
		replacements: [
			['dfs([])', '_record("calls", dfs([]))'],
			['            dfs(path)', '            _record("calls", dfs(path))'],
			['if used[i]:', 'if _record("candidate checks", used[i]):'],
			['res.append(path[:])', '_record("answers", res.append(_record("copied entries", path[:], len(path))))'],
		],
		expected: { calls: 16, 'candidate checks': 30, answers: 6, 'copied entries': 18 },
	},
	{
		name: 'Merge compares eight heads and writes nine output entries', sample: 'two-pointers/chapter3 sample 1',
		setup: `class _Output(list):
    def append(self, value):
        return _record("writes", super().append(value))
    def __iadd__(self, values):
        return _record("writes", super().__iadd__(values), len(values))
`,
		replacements: [['out = []', 'out = _Output()'], ['a[i] <= b[j]', '_record("comparisons", a[i] <= b[j])']],
		expected: { comparisons: 8, writes: 9 },
	},
	{
		name: 'Sliding Window counts failed back comparisons as well as removals', sample: 'heaps-and-queues/chapter3 sample 1',
		replacements: [
			['a[dq[-1]] <= x', '_record("back comparisons", a[dq[-1]] <= x)'],
			['dq.pop()', '_record("removals", dq.pop())'],
			['dq.append(i)', '_record("pushes", dq.append(i))'],
			['dq.popleft()', '_record("removals", dq.popleft())'],
			['res.append(a[dq[0]])', '_record("answers", res.append(a[dq[0]]))'],
		],
		expected: { pushes: 8, removals: 6, 'back comparisons': 10, answers: 6 },
	},
	{
		name: 'Stones performs three rounds after Heapify', sample: 'heaps-and-queues/chapter2 sample 3',
		replacements: [
			['heapq.heapify(h)', '_record("heapified entries", heapq.heapify(h), len(h))'],
			['heapq.heappop(h)', '_record("pops", heapq.heappop(h))'],
			['heapq.heappush(h, -(y - x))', '_record("pushes", heapq.heappush(h, -(y - x)))'],
		],
		expected: { 'heapified entries': 4, pops: 6, pushes: 3 },
	},
	{
		name: 'K-Way Merge pushes only the six successors after Heapify', sample: 'heaps-and-queues/chapter4 sample 1',
		replacements: [
			['heapq.heapify(h)', '_record("heapified entries", heapq.heapify(h), len(h))'],
			['heapq.heappop(h)', '_record("pops", heapq.heappop(h))'],
			['heapq.heappush(h, (lists[i][j + 1], i, j + 1))', '_record("pushes", heapq.heappush(h, (lists[i][j + 1], i, j + 1)))'],
			['out.append(v)', '_record("writes", out.append(v))'],
		],
		expected: { 'heapified entries': 3, pops: 9, pushes: 6, writes: 9 },
	},
];

for (const item of countCases) {
	test(item.name, async () => {
		const sample = samples.find(sample => sample.name === item.sample);
		expect(sample, item.sample).toBeDefined();
		let code = sample!.code;
		for (const [from, to] of item.replacements) {
			expect(code, `Review instrumentation for ${item.sample}`).toContain(from);
			code = code.replaceAll(from, to);
		}
		const output = await runSample(`_counts = {}
def _record(name, value, amount=1):
    _counts[name] = _counts.get(name, 0) + amount
    return value
${item.setup ?? ''}${code}
import json
print(json.dumps(_counts))`);
		const lines = output.trimEnd().split('\n');
		expect(JSON.parse(lines.pop()!)).toEqual(item.expected);
		expect(lines.join('\n') + '\n').toBe(expectedSamples.find(sample => sample.name === item.sample)?.output);
	});
}
