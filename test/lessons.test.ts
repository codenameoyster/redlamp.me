import { env, exports } from 'cloudflare:workers';
import { beforeEach, expect, it } from 'vitest';
import { login, request } from './client';

let parent: string;
beforeEach(async () => { parent = await login('parent'); });
async function upload(bytes: string | Uint8Array, cookie = parent, filename = 'lesson.html', metadata: unknown = { title: 'Lesson', description: '', topics: [] }) {
	const body = new FormData();
	if (metadata !== null) body.set('metadata', JSON.stringify(metadata));
	body.set('file', new File([typeof bytes === 'string' ? bytes : new Uint8Array(bytes)], filename, { type: 'text/html' }));
	const req = new Request('https://redlamp.me/leetcode/api/lessons', { method: 'POST', headers: { Cookie: cookie, Origin: 'https://redlamp.me' }, body });
	expect(req.headers.has('content-length')).toBe(false);
	return exports.default.fetch(req);
}

it.each([
	{ name: 'exact byte limit without length header', text: 'a'.repeat(1_000_000), expected: 201 },
	{ name: 'one byte over', text: 'a'.repeat(1_000_001), expected: 413 },
	{ name: 'multibyte exact limit', text: 'я'.repeat(500_000), expected: 201 },
	{ name: 'multibyte overflow', text: 'я'.repeat(500_001), expected: 413 },
])('$name', async ({ text, expected }) => { expect((await upload(text)).status).toBe(expected); });

it.each([
	{ name: 'invalid UTF-8', bytes: new Uint8Array([255]), file: 'lesson.html', metadata: { title: 'Lesson' }, expected: 400 },
	{ name: 'wrong extension', bytes: new TextEncoder().encode('text'), file: 'lesson.txt', metadata: { title: 'Lesson' }, expected: 400 },
	{ name: 'missing metadata', bytes: new TextEncoder().encode('<p>Hi</p>'), file: 'lesson.html', metadata: null, expected: 400 },
	{ name: 'total multipart overflow', bytes: new TextEncoder().encode('a'.repeat(1_000_000)), file: 'lesson.html', metadata: { title: 'x'.repeat(33_000) }, expected: 413 },
])('$name', async ({ bytes, file, metadata, expected }) => {
	expect((await upload(bytes, parent, file, metadata)).status).toBe(expected);
	expect(await env.DB.prepare('SELECT count(*) AS count FROM lessons').first()).toEqual({ count: 0 });
});

it('preserves UTF-8 export bytes and private download access', async () => {
	const original = new TextEncoder().encode('\uFEFF<!doctype html>\r\n<p>Инвариант</p>\r\n');
	const uploaded = await upload(original);
	expect(uploaded.status).toBe(201);
	const { id } = await uploaded.json() as { id: string };
	const response = await request(`/lessons/${id}/download`, 'GET', undefined, parent);
	expect(new Uint8Array(await response.arrayBuffer())).toEqual(original);
	expect(response.headers.get('content-disposition')).toContain('attachment;');
	expect((await request(`/lessons/${id}/download`)).status).toBe(401);
	expect((await request(`/lessons/${id}/content`)).status).toBe(401);
	const head = await request(`/lessons/${id}/content`, 'HEAD', undefined, parent);
	expect(head.headers.get('content-security-policy')).toContain('sandbox allow-scripts;');
	expect(head.headers.get('cache-control')).toBe('private, no-store');
	expect(await head.text()).toBe('');
});

it('denies student uploads and keeps archived lessons on existing links', async () => {
	expect((await upload('<p>Lesson</p>', await login())).status).toBe(403);
	const lesson = await (await upload('<p>Lesson</p>')).json() as { id: string };
	const problem = await (await request('/problems', 'POST', { url: 'https://leetcode.com/problems/two-sum/', title: 'Two Sum', number: 1, difficulty: 'easy', topics: [], summary: '' }, parent)).json() as { id: string };
	const link = `/problems/${problem.id}/lessons/${lesson.id}`;
	expect((await request(link, 'PUT', {}, parent)).status).toBe(204);
	expect((await request(`/lessons/${lesson.id}/archive`, 'POST', { version: 1 }, parent)).status).toBe(200);
	expect(await (await request(`/problems/${problem.id}/lessons`, 'GET', undefined, parent)).json()).toMatchObject({ items: [{ id: lesson.id }] });
	expect((await request(link, 'PUT', {}, parent)).status).toBe(409);
	expect((await request(`/lessons/${lesson.id}/content`, 'GET', undefined, await login())).status).toBe(200);
});

it('rejects stale homework lesson edits atomically', async () => {
	const lesson = await (await upload('<p>Lesson</p>')).json() as { id: string };
	const problem = await (await request('/problems', 'POST', { url: 'https://leetcode.com/problems/two-sum/', title: 'Two Sum', number: 1, difficulty: 'easy', topics: [], summary: '' }, parent)).json() as { id: string };
	const homework = await (await request('/homework', 'POST', { problemId: problem.id, instructions: '', dueDate: null }, parent)).json() as { id: string };
	const path = `/homework/${homework.id}/lessons/${lesson.id}`;
	expect((await request(path, 'PUT', { version: 2 }, parent)).status).toBe(409);
	expect(await env.DB.prepare('SELECT count(*) AS count FROM homework_lessons').first()).toEqual({ count: 0 });
	expect((await request(path, 'PUT', { version: 1 }, parent)).status).toBe(204);
	await env.DB.prepare("UPDATE homework SET state='submitted'").run();
	expect((await request(path, 'DELETE', { version: 2 }, parent)).status).toBe(409);
	expect(await env.DB.prepare('SELECT count(*) AS count FROM homework_lessons').first()).toEqual({ count: 1 });
});
