import { cp, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await cp('public', 'dist', { recursive: true });
const result = await Bun.build({
	entrypoints: ['web/main.tsx', 'web/style.css'],
	outdir: 'dist/leetcode/assets',
	naming: '[name].[ext]',
	target: 'browser',
	format: 'esm',
	minify: true,
	env: 'disable',
	define: { 'process.env.NODE_ENV': JSON.stringify('production') },
});
if (!result.success) throw new Error(result.logs.map(log => log.message).join('\n'));
