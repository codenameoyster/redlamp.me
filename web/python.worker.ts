import init, { PositionEncoding, Workspace, type Diagnostic as RuffDiagnostic } from '@astral-sh/ruff-wasm-web';
import { loadPyodide } from 'pyodide';
import harness from './harness.py' with { type: 'text' };
import { diagnosticText, type RunResult } from './python';
import { same } from '../shared/answers';

type Found = { line: number; column: number; code: string | null; message: string };
const ready = Promise.all([loadPyodide({ indexURL: '/leetcode/assets/pyodide/' }), init({ module_or_path: '/leetcode/assets/ruff/ruff_wasm_bg.wasm' })]).then(([python]) => {
	python.runPython(harness);
	// Ruff knows the names of the LeetCode namespace, so List or math without an import is not an error.
	const ruff = new Workspace({ builtins: JSON.parse(python.runPython('names()')), lint: { select: ['E9', 'F'] } }, PositionEncoding.Utf16);
	return { python, ruff, check: python.globals.get('check'), run: python.globals.get('run'), words: python.globals.get('words'), complete: python.globals.get('complete') };
});
let jedi: Promise<unknown> | undefined;

const handle = async ({ data }: MessageEvent) => {
	try {
		const { python, ruff, check, run, words, complete } = await ready, start = performance.now();
		if (data.type === 'run') {
			const result: Pick<RunResult, 'output' | 'stdout' | 'error'> = JSON.parse(run(data.code, JSON.stringify(data.spec), JSON.stringify(data.test)));
			const ok = data.test.expected === null ? null : result.error === null && same(data.spec, data.test.expected, result.output);
			return postMessage({ id: data.id, ...result, ok, ms: Math.round(performance.now() - start) });
		}
		if (data.type === 'words') return postMessage({ id: data.id, words: JSON.parse(words()) });
		if (data.type === 'format') {
			try { return postMessage({ id: data.id, code: ruff.format(data.code) }); }
			// The Ruff parser can stop after the line of the error, for example after an unclosed bracket. compile() gives the line that the live check shows.
			catch { return postMessage({ id: data.id, line: JSON.parse(check(data.code))[0].line }); }
		}
		if (data.type === 'complete') {
			await (jedi ??= python.loadPackage('jedi'));
			return postMessage({ id: data.id, names: JSON.parse(complete(data.code, data.line, data.column)) });
		}
		// compile() reports the syntax error, so the Ruff copy of it is not shown.
		const found: Found[] = [...(ruff.check(data.code) as RuffDiagnostic[]).filter(item => item.code !== 'invalid-syntax').map(item => ({ line: item.start_location.row, column: item.start_location.column, code: item.code, message: item.message })), ...JSON.parse(check(data.code))];
		postMessage({ id: data.id, diagnostics: found.sort((a, b) => a.line - b.line || a.column - b.column).map(item => ({ line: item.line, column: item.column, message: diagnosticText(item.line, item.code, item.message) })) });
	} catch (error) {
		console.error(error);
		postMessage({ id: data.id, failed: true });
	}
};
// A jedi load waits for the wheels. The queue keeps the load and the completion out of the time between the check and the run of a test.
let queue = Promise.resolve();
self.onmessage = event => { queue = queue.then(() => handle(event)); };
