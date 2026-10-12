import init, { PositionEncoding, Workspace, type Diagnostic as RuffDiagnostic } from '@astral-sh/ruff-wasm-web';
import { loadPyodide } from 'pyodide';
import harness from './harness.py' with { type: 'text' };
import { diagnosticText } from './python';

type Found = { line: number; column: number; code: string | null; message: string };
const ready = Promise.all([loadPyodide({ indexURL: '/leetcode/assets/pyodide/' }), init({ module_or_path: '/leetcode/assets/ruff/ruff_wasm_bg.wasm' })]).then(([python]) => {
	python.runPython(harness);
	// Ruff knows the names of the LeetCode namespace, so List or math without an import is not an error.
	const ruff = new Workspace({ builtins: JSON.parse(python.runPython('names()')), lint: { select: ['E9', 'F'] } }, PositionEncoding.Utf16);
	return { ruff, check: python.globals.get('check'), run: python.globals.get('run') };
});

self.onmessage = async ({ data }) => {
	try {
		const { ruff, check, run } = await ready, start = performance.now();
		if (data.type === 'run') return postMessage({ id: data.id, ...JSON.parse(run(data.code, JSON.stringify(data.spec), JSON.stringify(data.test))), ms: Math.round(performance.now() - start) });
		// compile() reports the syntax error, so the Ruff copy of it is not shown.
		const found: Found[] = [...(ruff.check(data.code) as RuffDiagnostic[]).filter(item => item.code !== 'invalid-syntax').map(item => ({ line: item.start_location.row, column: item.start_location.column, code: item.code, message: item.message })), ...JSON.parse(check(data.code))];
		postMessage({ id: data.id, diagnostics: found.sort((a, b) => a.line - b.line || a.column - b.column).map(item => ({ line: item.line, column: item.column, message: diagnosticText(item.line, item.code, item.message) })) });
	} catch (error) {
		console.error(error);
		postMessage({ id: data.id, failed: true });
	}
};
