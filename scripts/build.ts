import { cp, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await cp('public', 'dist', { recursive: true });
const result = await Bun.build({
	entrypoints: ['web/main.tsx', 'web/style.css', 'web/python.worker.ts'],
	outdir: 'dist/leetcode/assets',
	naming: '[name].[ext]',
	target: 'browser',
	format: 'esm',
	minify: true,
	external: ['/leetcode/assets/*'],
	env: 'disable',
	define: { 'process.env.NODE_ENV': JSON.stringify('production') },
});
if (!result.success) throw new Error(result.logs.map(log => log.message).join('\n'));
await cp('node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2', 'dist/leetcode/assets/jetbrains-mono-latin-wght-normal.woff2');
// The Python worker loads these files at run time from /leetcode/assets/pyodide/ and /leetcode/assets/ruff/.
for (const file of ['pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']) await cp(`node_modules/pyodide/${file}`, `dist/leetcode/assets/pyodide/${file}`);
await cp('node_modules/@astral-sh/ruff-wasm-web/ruff_wasm_bg.wasm', 'dist/leetcode/assets/ruff/ruff_wasm_bg.wasm');
