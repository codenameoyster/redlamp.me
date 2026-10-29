import { cp, rm } from 'node:fs/promises';

if (process.env.WORKERS_CI === '1' && process.env.WORKERS_CI_BRANCH === 'main') await import('./release');
const { version } = await Bun.file('package.json').json() as { version: string };
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
	define: { 'process.env.NODE_ENV': JSON.stringify('production'), __APP_VERSION__: JSON.stringify(version) },
});
if (!result.success) throw new Error(result.logs.map(log => log.message).join('\n'));
await cp('node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2', 'dist/leetcode/assets/jetbrains-mono-latin-wght-normal.woff2');
// The Python worker loads these files at run time from /leetcode/assets/pyodide/ and /leetcode/assets/ruff/.
for (const file of ['pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']) await cp(`node_modules/pyodide/${file}`, `dist/leetcode/assets/pyodide/${file}`);
// The jedi and parso wheels come from public/. Pyodide does not load a wheel whose sha256 is not the one in its lock, and it does not throw.
const lock = await Bun.file('node_modules/pyodide/pyodide-lock.json').json() as { packages: Record<string, { file_name: string; sha256: string }> }, pyodide = (await Bun.file('node_modules/pyodide/package.json').json() as { version: string }).version;
for (const { file_name, sha256 } of [lock.packages.jedi, lock.packages.parso]) if (new Bun.CryptoHasher('sha256').update(await Bun.file(`dist/leetcode/assets/pyodide/${file_name}`).bytes()).digest('hex') !== sha256) throw new Error(`Put ${file_name} from https://cdn.jsdelivr.net/pyodide/v${pyodide}/full/ in public/leetcode/assets/pyodide/.`);
await cp('node_modules/@astral-sh/ruff-wasm-web/ruff_wasm_bg.wasm', 'dist/leetcode/assets/ruff/ruff_wasm_bg.wasm');
