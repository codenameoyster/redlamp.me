import { env, exports } from 'cloudflare:workers';
import { expect, it } from 'vitest';
import worker from '../src/index';
import { login, request } from './client';

const cases = [
	{ name: 'wrong password', username: 'student-test', password: 'wrong', origin: 'https://redlamp.me', expected: 401 },
	{ name: 'unknown username', username: 'unknown', password: 'wrong', origin: 'https://redlamp.me', expected: 401 },
	{ name: 'cross-origin login', username: 'student-test', password: 'student-test-password-01', origin: 'https://other.example', expected: 403 },
	{ name: 'null origin', username: 'student-test', password: 'student-test-password-01', origin: 'null', expected: 403 },
	{ name: 'valid student', username: 'student-test', password: 'student-test-password-01', origin: 'https://redlamp.me', expected: 200 },
];
it.each(cases)('$name', async ({ username, password, origin, expected }) => {
	const response = await exports.default.fetch('https://redlamp.me/leetcode/api/session', {
		method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': crypto.randomUUID() }, body: JSON.stringify({ username, password }),
	});
	expect(response.status).toBe(expected);
	if (expected === 200) {
		const cookie = response.headers.get('set-cookie')!;
		expect(cookie).toMatch(/^__Host-redlamp-leetcode=/);
		expect(cookie).toContain('HttpOnly');
		expect(cookie).toContain('Secure');
		expect(cookie).toContain('SameSite=Lax');
		expect(cookie).toContain('Path=/');
		const row = await env.DB.prepare('SELECT token_hash FROM sessions').first<{ token_hash: string }>();
		expect(cookie).not.toContain(row!.token_hash);
	}
});

it.each([
	{ name: 'absent token', change: 'absent' },
	{ name: 'expired token', change: 'expired' },
	{ name: 'rotated credentials', change: 'rotated' },
	{ name: 'logout', change: 'logout' },
])('$name blocks private data', async ({ change }) => {
	const cookie = change === 'absent' ? '' : await login();
	if (change === 'expired') await env.DB.prepare('UPDATE sessions SET expires_at=0').run();
	if (change === 'logout') expect((await request('/session', 'DELETE', undefined, cookie)).status).toBe(204);
	const accounts = JSON.parse(env.LEETCODE_ACCOUNTS);
	if (change === 'rotated') accounts.student.passwordHash = '0'.repeat(64);
	const response = await worker.fetch(new Request('https://redlamp.me/leetcode/api/session', { headers: { Cookie: cookie } }), { ...env, LEETCODE_ACCOUNTS: JSON.stringify(accounts) });
	expect(response.status).toBe(401);
});

it('returns the same failure for bad and unknown credentials', async () => {
	const bad = await request('/session', 'POST', { username: 'student-test', password: 'wrong' });
	const unknown = await request('/session', 'POST', { username: 'unknown', password: 'wrong' });
	expect(await bad.json()).toEqual(await unknown.json());
});

it.each([
	{ name: 'missing secret', secret: '' },
	{ name: 'malformed secret', secret: '{' },
	{ name: 'missing role', secret: '{"parent":{}}' },
])('$name fails closed', async ({ secret }) => {
	const response = await worker.fetch(new Request('https://redlamp.me/leetcode/api/session'), { ...env, LEETCODE_ACCOUNTS: secret });
	expect(response.status).toBe(503);
	expect(response.headers.get('cache-control')).toBe('private, no-store');
});

it('limits the eleventh attempt from one source', async () => {
	const source = crypto.randomUUID();
	const init = { method: 'POST', headers: { Origin: 'https://redlamp.me', 'Content-Type': 'application/json', 'CF-Connecting-IP': source }, body: JSON.stringify({ username: 'unknown', password: 'wrong' }) };
	for (let attempt = 0; attempt < 10; attempt++) expect((await exports.default.fetch('https://redlamp.me/leetcode/api/session', init)).status).toBe(401);
	expect((await exports.default.fetch('https://redlamp.me/leetcode/api/session', init)).status).toBe(429);
});

it('rejects oversized and non-JSON login requests', async () => {
	expect((await request('/session', 'POST', { username: 'student-test', password: 'x'.repeat(4096) })).status).toBe(413);
	const response = await exports.default.fetch('https://redlamp.me/leetcode/api/session', { method: 'POST', headers: { Origin: 'https://redlamp.me' }, body: '{}' });
	expect(response.status).toBe(400);
});

it('protects aliases and returns a JSON not-found for an unknown API', async () => {
	const cookie = await login();
	expect((await request('/missing', 'GET', undefined, cookie)).status).toBe(404);
	const response = await exports.default.fetch('https://www.redlamp.me/leetcode', { redirect: 'manual' });
	expect(response.headers.get('location')).toBe('https://redlamp.me/leetcode');
});
