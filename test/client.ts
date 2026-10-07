import { exports } from 'cloudflare:workers';
import { expect } from 'vitest';
import type { Role } from '../shared/leetcode';

export function request(path: string, method = 'GET', body?: unknown, cookie = '') {
	return exports.default.fetch(`https://redlamp.me/leetcode/api${path}`, {
		method,
		headers: { Cookie: cookie, Origin: 'https://redlamp.me', 'Content-Type': 'application/json', 'CF-Connecting-IP': crypto.randomUUID() },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
}

export async function login(role: Role = 'student') {
	const response = await request('/session', 'POST', {
		username: `${role}-test`, password: role === 'student' ? 'student-test-password-01' : 'parent-test-password-001',
	});
	expect(response.status).toBe(200);
	return response.headers.get('set-cookie')!.split(';')[0];
}
