import { env, exports } from 'cloudflare:workers';
import { beforeEach, expect, it } from 'vitest';
import { login, request } from './client';
import { LESSON_CSP } from '../src/leetcode/lessons';
import LESSON_BRIDGE from '../src/leetcode/lesson-bridge.html';

let parent: string;
const problemInput = { url: 'https://leetcode.com/problems/two-sum/', title: 'Two Sum', number: 1, difficulty: 'easy', topics: [], summary: '' };
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
	{ name: 'student upload', bytes: new TextEncoder().encode('<p>Lesson</p>'), file: 'lesson.html', metadata: { title: 'Lesson', description: '', topics: [] }, student: true, expected: 403 },
])('$name', async ({ bytes, file, metadata, student, expected }) => {
	expect((await upload(bytes, student ? await login() : parent, file, metadata)).status).toBe(expected);
	expect(await env.DB.prepare('SELECT count(*) AS count FROM lessons').first()).toEqual({ count: 0 });
});

const exported = new TextEncoder().encode('\uFEFF<!doctype html>\r\n<p>Инвариант</p>\r\n'), bridged = new Uint8Array([...exported, ...new TextEncoder().encode(LESSON_BRIDGE)]);
it.each([
	{ name: 'download keeps the exported UTF-8 bytes', method: 'GET', resource: 'download', role: 'parent', status: 200, headers: { 'content-disposition': expect.stringContaining('attachment;') }, body: exported },
	{ name: 'student download keeps the exported bytes', method: 'GET', resource: 'download', role: 'student', status: 200, headers: { 'content-disposition': expect.stringContaining('attachment;') }, body: exported },
	{ name: 'student content keeps the BOM first and ends with the bridge', method: 'GET', resource: 'content', role: 'student', status: 200, headers: { 'content-security-policy': LESSON_CSP }, body: bridged },
	{ name: 'parent content is unchanged', method: 'GET', resource: 'content', role: 'parent', status: 200, headers: { 'content-security-policy': LESSON_CSP }, body: exported },
	{ name: 'anonymous download', method: 'GET', resource: 'download', role: null, status: 401, headers: {}, body: null },
	{ name: 'anonymous content', method: 'GET', resource: 'content', role: null, status: 401, headers: {}, body: null },
	{ name: 'content HEAD without a body', method: 'HEAD', resource: 'content', role: 'parent', status: 200, headers: { 'content-security-policy': expect.stringContaining('sandbox allow-scripts;'), 'cache-control': 'private, no-store' }, body: new Uint8Array() },
])('$name', async ({ method, resource, role, status, headers, body }) => {
	const uploaded = await upload(exported);
	expect(uploaded.status).toBe(201);
	const { id } = await uploaded.json() as { id: string };
	const response = await request(`/lessons/${id}/${resource}`, method, undefined, role === 'parent' ? parent : role ? await login() : '');
	expect(response.status).toBe(status);
	expect(Object.fromEntries(response.headers)).toMatchObject(headers);
	if (body) expect(new Uint8Array(await response.arrayBuffer())).toEqual(body);
});

it('keeps an archived lesson on its existing problem link', async () => {
	const lesson = await (await upload('<p>Lesson</p>')).json() as { id: string }, problem = await (await request('/problems', 'POST', problemInput, parent)).json() as { id: string };
	expect((await request(`/problems/${problem.id}/lessons/${lesson.id}`, 'PUT', {}, parent)).status).toBe(204);
	expect((await request(`/lessons/${lesson.id}/archive`, 'POST', { version: 1 }, parent)).status).toBe(200);
	expect(await (await request(`/problems/${problem.id}/lessons`, 'GET', undefined, parent)).json()).toMatchObject({ items: [{ id: lesson.id }] });
});

it.each([
	{ name: 'problem link to an archived lesson', method: 'PUT', target: 'link', role: 'parent', body: {}, expected: 409 },
	{ name: 'student opens an archived lesson', method: 'GET', target: 'content', role: 'student', body: undefined, expected: 200 },
])('$name', async ({ method, target, role, body, expected }) => {
	const lesson = await (await upload('<p>Lesson</p>')).json() as { id: string }, problem = await (await request('/problems', 'POST', problemInput, parent)).json() as { id: string };
	expect((await request(`/lessons/${lesson.id}/archive`, 'POST', { version: 1 }, parent)).status).toBe(200);
	const path = target === 'link' ? `/problems/${problem.id}/lessons/${lesson.id}` : `/lessons/${lesson.id}/content`;
	expect((await request(path, method, body, role === 'parent' ? parent : await login())).status).toBe(expected);
});

it.each([
	{ name: 'homework lesson link', state: 'assigned', linked: false, method: 'PUT', version: 1, expected: 204, count: 1, stored: 2 },
	{ name: 'stale homework lesson link', state: 'assigned', linked: false, method: 'PUT', version: 2, expected: 409, count: 0, stored: 1 },
	{ name: 'lesson unlink from homework with a submitted task', state: 'submitted', linked: true, method: 'DELETE', version: 1, expected: 204, count: 0, stored: 2 },
	{ name: 'lesson link to homework with a completed task', state: 'completed', linked: false, method: 'PUT', version: 1, expected: 204, count: 1, stored: 2 },
])('$name', async ({ state, linked, method, version, expected, count, stored }) => {
	const lesson = await (await upload('<p>Lesson</p>')).json() as { id: string }, problem = await (await request('/problems', 'POST', problemInput, parent)).json() as { id: string };
	const homework = await (await request('/homework', 'POST', { title: 'Week 41', instructions: '', dueDate: null }, parent)).json() as { id: string };
	expect((await request('/tasks', 'POST', { homeworkId: homework.id, problemId: problem.id }, parent)).status).toBe(201);
	await env.DB.prepare('UPDATE homework_tasks SET state=?').bind(state).run();
	if (linked) await env.DB.prepare('INSERT INTO homework_lessons (homework_id,lesson_id) VALUES (?,?)').bind(homework.id, lesson.id).run();
	expect((await request(`/homework/${homework.id}/lessons/${lesson.id}`, method, { version }, parent)).status).toBe(expected);
	expect(await env.DB.prepare('SELECT count(*) AS count FROM homework_lessons').first()).toEqual({ count });
	expect(await env.DB.prepare('SELECT version FROM homework').first()).toEqual({ version: stored });
});
