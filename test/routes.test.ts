import { exports } from 'cloudflare:workers';
import { expect, it } from 'vitest';

const cases = [
	{ name: 'private root', path: '/leetcode', status: 302, type: null },
	{ name: 'private slash', path: '/leetcode/', status: 302, type: null },
	{ name: 'private HTML alias', path: '/leetcode/index.html', status: 302, type: null },
	{ name: 'root HTML alias', path: '/leetcode.html', status: 302, type: null },
	{ name: 'anonymous API', path: '/leetcode/api/problems', status: 401, type: 'application/json' },
	{ name: 'login shell', path: '/leetcode/login', status: 200, type: 'text/html' },
	{ name: 'login script asset', path: '/leetcode/assets/main.js', status: 200, type: null },
	{ name: 'public fallback', path: '/', status: 200, type: null },
];
it.each(cases)('$name', async ({ path, status, type }) => {
	const response = await exports.default.fetch(`https://redlamp.me${path}`, { redirect: 'manual' });
	expect(response.status).toBe(status);
	if (type) expect(response.headers.get('content-type')).toContain(type);
	if (status === 302) expect(response.headers.get('location')).toMatch(/^\/leetcode\/login/);
	if (!path.includes('assets') && path.startsWith('/leetcode')) {
		expect(response.headers.get('cache-control')).toBe('private, no-store');
	}
});
