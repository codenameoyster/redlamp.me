import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { login, request } from './client';

let cookie: string;
const input = { url: 'https://leetcode.com/problems/two-sum/', number: 1, title: 'Two Sum', difficulty: 'easy', topics: ['Arrays'], summary: '' };
beforeEach(async () => { cookie = await login(); });
afterEach(() => { vi.restoreAllMocks(); });

it.each([
	{ name: 'canonical link', url: 'https://leetcode.com/problems/two-sum/', expected: 'two-sum' },
	{ name: 'description link', url: 'https://leetcode.com/problems/two-sum/description/?envType=daily-question#notes', expected: 'two-sum' },
	{ name: 'foreign host', url: 'https://leetcode.com.evil.example/problems/two-sum/', expected: null },
	{ name: 'missing slug', url: 'https://leetcode.com/problems/', expected: null },
	{ name: 'insecure URL', url: 'http://leetcode.com/problems/two-sum/', expected: null },
	{ name: 'URL with credentials', url: 'https://user@leetcode.com/problems/two-sum/', expected: null },
])('$name', async ({ url, expected }) => {
	const response = await request('/problems', 'POST', { ...input, url }, cookie);
	expect(response.status).toBe(expected === null ? 400 : 201);
	if (expected) expect(await response.json()).toMatchObject({ slug: expected, url: 'https://leetcode.com/problems/two-sum/' });
});

it('returns the existing problem for a duplicate URL', async () => {
	const first = await (await request('/problems', 'POST', input, cookie)).json();
	const second = await request('/problems', 'POST', { ...input, url: `${input.url}description/` }, cookie);
	expect(second.status).toBe(200);
	expect(await second.json()).toEqual(first);
	expect(await env.DB.prepare('SELECT count(*) AS count FROM problems').first()).toEqual({ count: 1 });
});

it('finds Unicode notes as literal text', async () => {
	const first = crypto.randomUUID(), second = crypto.randomUUID();
	const problem = env.DB.prepare("INSERT INTO problems (id,slug,title,difficulty,topics,summary,search_text,created_at,updated_at) VALUES (?,?,'Search fixture','medium','[]','','','now','now')");
	const attempt = env.DB.prepare("INSERT INTO attempts (id,problem_id,state,document,search_text,acceptance,understanding,created_at,updated_at) VALUES (?,?,'draft','{}',?,'not_submitted','needs_practice','now','now')");
	await env.DB.batch([problem.bind(first, 'one'), problem.bind(second, 'two'), attempt.bind(crypto.randomUUID(), first, 'инвариант 100%_ready'), attempt.bind(crypto.randomUUID(), second, 'инвариант 100xready')]);
	const response = await request(`/problems?${new URLSearchParams({ q: 'ИНВАРИАНТ 100%_ready' })}`, 'GET', undefined, cookie);
	expect(response.status).toBe(200);
	const body = await response.json() as { items: { id: string }[] };
	expect(body.items.map(item => item.id)).toEqual([first]);
});

it.each([
	{ name: 'current edit', stored: 1, expected: 200, title: 'Updated' },
	{ name: 'stale edit', stored: 2, expected: 409, title: 'Two Sum' },
])('$name', async ({ stored, expected, title }) => {
	const problem = await (await request('/problems', 'POST', input, cookie)).json() as { id: string };
	await env.DB.prepare('UPDATE problems SET version=?').bind(stored).run();
	expect((await request(`/problems/${problem.id}`, 'PATCH', { ...input, version: 1, title: 'Updated' }, cookie)).status).toBe(expected);
	expect(await (await request(`/problems/${problem.id}`, 'GET', undefined, cookie)).json()).toMatchObject({ title, version: 2 });
});

it('archives a problem after its active homework completes', async () => {
	const problem = await (await request('/problems', 'POST', input, cookie)).json() as { id: string };
	const path = `/problems/${problem.id}`;
	await env.DB.prepare("INSERT INTO homework (id,problem_id,instructions,state,created_at,updated_at) VALUES (?,?,'Explain','assigned','now','now')").bind(crypto.randomUUID(), problem.id).run();
	expect((await request(`${path}/archive`, 'POST', { version: 1 }, cookie)).status).toBe(409);
	await env.DB.prepare("UPDATE homework SET state='completed'").run();
	expect((await request(`${path}/archive`, 'POST', { version: 1 }, cookie)).status).toBe(200);
	expect(await (await request('/problems', 'GET', undefined, cookie)).json()).toMatchObject({ items: [] });
	expect(await (await request(path, 'GET', undefined, cookie)).json()).toMatchObject({ title: input.title });
});

it.each([
	{ name: 'archive with active homework', action: 'archive', archivedAt: null, homework: 'assigned', stored: 1, error: { code: 'active_homework', message: 'Complete or cancel the active homework before you archive this problem.' } },
	{ name: 'stale archive', action: 'archive', archivedAt: null, homework: 'completed', stored: 2, error: { code: 'conflict' } },
	{ name: 'stale restore', action: 'restore', archivedAt: 'now', homework: 'completed', stored: 2, error: { code: 'conflict' } },
])('$name', async ({ action, archivedAt, homework, stored, error }) => {
	const problem = await (await request('/problems', 'POST', input, cookie)).json() as { id: string };
	await env.DB.prepare('UPDATE problems SET archived_at=?,version=?').bind(archivedAt, stored).run();
	await env.DB.prepare("INSERT INTO homework (id,problem_id,instructions,state,created_at,updated_at) VALUES (?,?,'Explain',?,'now','now')").bind(crypto.randomUUID(), problem.id, homework).run();
	const response = await request(`/problems/${problem.id}/${action}`, 'POST', { version: 1 }, cookie);
	expect(response.status).toBe(409);
	expect(await response.json()).toMatchObject({ error });
	expect(await env.DB.prepare('SELECT archived_at AS archivedAt,version FROM problems').first()).toEqual({ archivedAt, version: stored });
});

it('restores an archived problem to the library and to homework', async () => {
	const problem = await (await request('/problems', 'POST', input, cookie)).json() as { id: string };
	const parent = await login('parent');
	expect((await request(`/problems/${problem.id}/archive`, 'POST', { version: 1 }, cookie)).status).toBe(200);
	const restored = await request(`/problems/${problem.id}/restore`, 'POST', { version: 2 }, parent);
	expect(restored.status).toBe(200);
	expect(await restored.json()).toMatchObject({ id: problem.id, archivedAt: null, version: 3 });
	expect(await (await request('/problems', 'GET', undefined, cookie)).json()).toMatchObject({ items: [{ id: problem.id }] });
	expect((await request('/homework', 'POST', { problemId: problem.id, instructions: '', dueDate: null }, parent)).status).toBe(201);
});

it.each([
	{ name: 'page with more results', query: 'limit=1', status: 200, body: { nextOffset: 1 } },
	{ name: 'last page', query: 'limit=1&offset=1', status: 200, body: { nextOffset: null } },
	{ name: 'combined filters without a match', query: 'difficulty=hard&topic=Arrays', status: 200, body: { items: [] } },
	{ name: 'page size above the limit', query: 'limit=51', status: 400, body: null },
	{ name: 'impossible due date', query: 'due=2026-02-30', status: 400, body: null },
])('$name', async ({ query, status, body }) => {
	await request('/problems', 'POST', input, cookie);
	await request('/problems', 'POST', { ...input, url: 'https://leetcode.com/problems/three-sum/', difficulty: 'medium' }, cookie);
	const response = await request(`/problems?${query}`, 'GET', undefined, cookie);
	expect(response.status).toBe(status);
	if (body) expect(await response.json()).toMatchObject(body);
});

const question = { questionFrontendId: '1', title: 'Two Sum', difficulty: 'Easy', topicTags: [{ name: 'Array' }, { name: 'Hash Table' }] };
it.each([
	{ name: 'details from a description link', url: 'https://leetcode.com/problems/two-sum/description/', reply: () => Response.json({ data: { question } }), status: 200, body: { number: 1, title: 'Two Sum', difficulty: 'easy', topics: ['Array', 'Hash Table'] }, slug: 'two-sum' },
	{ name: 'details without a numeric problem ID', url: 'https://leetcode.com/problems/two-sum/', reply: () => Response.json({ data: { question: { ...question, questionFrontendId: 'LCP 01' } } }), status: 200, body: { number: null, title: 'Two Sum' }, slug: 'two-sum' },
	{ name: 'unknown LeetCode problem', url: 'https://leetcode.com/problems/two-sum/', reply: () => Response.json({ data: { question: null } }), status: 404, body: { error: { code: 'not_found' } }, slug: 'two-sum' },
	{ name: 'LeetCode error response', url: 'https://leetcode.com/problems/two-sum/', reply: () => new Response('Busy', { status: 503 }), status: 502, body: { error: { code: 'lookup_failed' } }, slug: 'two-sum' },
	{ name: 'unreachable LeetCode', url: 'https://leetcode.com/problems/two-sum/', reply: () => { throw new TypeError('Network connection lost.'); }, status: 502, body: { error: { code: 'lookup_failed' } }, slug: 'two-sum' },
	{ name: 'details for a URL outside LeetCode', url: 'https://example.com/problems/two-sum/', reply: () => Response.json({}), status: 400, body: { error: { code: 'invalid_url' } }, slug: null },
])('$name', async ({ url, reply, status, body, slug }) => {
	const leetcode = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => reply());
	const response = await request(`/problem-details?url=${encodeURIComponent(url)}`, 'GET', undefined, cookie);
	expect(response.status).toBe(status);
	expect(await response.json()).toMatchObject(body);
	expect(leetcode.mock.calls.map(([target, init]) => [String(target), JSON.parse(String(init?.body)).variables.titleSlug])).toEqual(slug ? [['https://leetcode.com/graphql', slug]] : []);
});
