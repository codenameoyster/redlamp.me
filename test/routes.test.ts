import { exports } from 'cloudflare:workers';
import { expect, it } from 'vitest';
import { login } from './client';

const cases = [
	{ name: 'private root', path: '/leetcode', status: 302, location: '/leetcode/login?return=%2Fleetcode' },
	{ name: 'private slash', path: '/leetcode/', status: 302, location: '/leetcode/login?return=%2Fleetcode' },
	{ name: 'private HTML alias', path: '/leetcode/index.html', status: 302, location: '/leetcode/login?return=%2Fleetcode' },
	{ name: 'root HTML alias', path: '/leetcode.html', status: 302, location: '/leetcode/login?return=%2Fleetcode' },
	{ name: 'private page with query', path: '/leetcode/problems?due=2026-10-07', status: 302, location: '/leetcode/login?return=%2Fleetcode%2Fproblems%3Fdue%3D2026-10-07' },
	{ name: 'private page slash alias', path: '/leetcode/problems/', status: 302, location: '/leetcode/login?return=%2Fleetcode%2Fproblems' },
	{ name: 'private unknown page', path: '/leetcode/missing', status: 302, location: '/leetcode/login?return=%2Fleetcode%2Fmissing' },
	{ name: 'signed-in HTML alias with query', path: '/leetcode/problems.html?q=x', signedIn: true, status: 302, location: '/leetcode/problems?q=x' },
	{ name: 'signed-in unknown page', path: '/leetcode/missing', signedIn: true, status: 404, type: 'application/json' },
	{ name: 'signed-in shell', path: '/leetcode/problems', signedIn: true, status: 200, type: 'text/html', session: '{"role":"student","username":"student-test"}' },
	{ name: 'anonymous API', path: '/leetcode/api/problems', status: 401, type: 'application/json' },
	{ name: 'signed-in unknown API', path: '/leetcode/api/missing', signedIn: true, status: 404, type: 'application/json' },
	{ name: 'login shell', path: '/leetcode/login', status: 200, type: 'text/html', session: null },
	{ name: 'login script asset', path: '/leetcode/assets/main.js', status: 200, asset: true },
	{ name: 'asset path with encoded slash', path: '/leetcode/assets%2Fmain.js', status: 307, location: '/leetcode/assets/main.js', asset: true },
	{ name: 'asset path with encoded letter', path: '/leetcode/%61ssets/main.js', status: 307, location: '/leetcode/assets/main.js', asset: true },
	{ name: 'public fallback', path: '/', status: 200 },
];
it.each(cases)('$name', async ({ path, signedIn, status, type, location, session, asset }) => {
	const response = await exports.default.fetch(`https://redlamp.me${path}`, { redirect: 'manual', headers: { Cookie: signedIn ? await login() : '' } });
	expect(response.status).toBe(status);
	if (type) expect(response.headers.get('content-type')).toContain(type);
	if (location) expect(response.headers.get('location')).toBe(location);
	if (session) expect(await response.text()).toContain(`<script id="session" type="application/json">${session}</script>`);
	if (session === null) expect(await response.text()).not.toContain('id="session"');
	if (!asset && path.startsWith('/leetcode')) expect(response.headers.get('cache-control')).toBe('private, no-store');
	if (asset) expect(response.headers.get('x-robots-tag')).toBeNull();
});
