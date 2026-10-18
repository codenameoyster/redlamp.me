import { globSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { loadPyodide } from 'pyodide';
import { same } from '../shared/answers';

// Each lesson sample with a run button runs through web/harness.py, as the button runs it. Workers do not allow WebAssembly.compile, so this check runs in Node and not in vitest. https://developers.cloudflare.com/workers/runtime-apis/web-standards/#javascript-standards
// The test opens no page, so it needs no server and no browser.
const root = 'src/leetcode/sets', entities: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', '#39': "'" };
const lessons = globSync(`${root}/*/chapter*.html`).flatMap(path => {
	const html = readFileSync(path, 'utf8');
	// The rule of the button: code.language-python in a <pre> without the class no-run.
	return [...html.matchAll(/<pre(?![^>]*\bno-run\b)[^>]*><code class="language-python">([\s\S]*?)<\/code>/g)].map(match => ({ name: `${path.slice(root.length + 1)}:${html.slice(0, match.index).split('\n').length}`, code: match[1].replace(/&(lt|gt|amp|quot|#39);/g, (_, name: string) => entities[name]), input: '', expected: null as string | null }));
});
// The starter code of a Codeforces task is a function for one test, called once for each test. The placeholder returns 0.
const starter = 'def ans():\n    N = int(input())\n    a = list(map(int, input().split()))\n    # Посчитайте ответ и верните его.\n    return 0\n\nt = int(input())\na = [ans() for _ in range(t)]\nfor res in a:\n    print(res)\n';
const samples = [...lessons, { name: 'starter code of a Codeforces task', code: starter, input: '2\n3\n1 2 3\n1\n5\n', expected: '0\n0\n' }];

let run: Promise<(code: string, spec: string, test: string) => string> | undefined;
for (const sample of samples) {
	test(sample.name, async () => {
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
		const result = JSON.parse((await run)(sample.code, JSON.stringify({ mode: 'stdio' }), JSON.stringify({ input: sample.input, expected: sample.expected }))) as { output: string; error: { message: string; line: number | null } | null };
		expect(result.error).toBeNull();
		if (sample.expected !== null) expect(same({ mode: 'stdio' }, sample.expected, result.output)).toBe(true);
		expect(result.output.trim()).not.toBe('');
	});
}
