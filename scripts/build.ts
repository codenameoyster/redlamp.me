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
	external: ['/leetcode/assets/*'],
	env: 'disable',
	define: { 'process.env.NODE_ENV': JSON.stringify('production') },
});
if (!result.success) throw new Error(result.logs.map(log => log.message).join('\n'));
for (const font of ['bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2', 'jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2']) await cp(`node_modules/@fontsource-variable/${font}`, `dist/leetcode/assets/${font.split('/').at(-1)}`);
