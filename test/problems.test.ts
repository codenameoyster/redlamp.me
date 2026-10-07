import { env } from 'cloudflare:workers';
import { beforeEach, expect, it } from 'vitest';
import { login, request } from './client';

let cookie: string;
const input = { url: 'https://leetcode.com/problems/two-sum/', number: 1, title: 'Two Sum', difficulty: 'easy', topics: ['Arrays'], summary: '' };
beforeEach(async () => { cookie = await login(); });

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

it('rejects a stale edit and blocks archive with active homework', async () => {
	const problem = await (await request('/problems', 'POST', input, cookie)).json() as { id: string };
	const path = `/problems/${problem.id}`;
	expect((await request(path, 'PATCH', { ...input, version: 1, title: 'Updated' }, cookie)).status).toBe(200);
	expect((await request(path, 'PATCH', { ...input, version: 1 }, cookie)).status).toBe(409);
	await env.DB.prepare("INSERT INTO homework (id,problem_id,instructions,state,created_at,updated_at) VALUES (?,?,'Explain','assigned','now','now')").bind(crypto.randomUUID(), problem.id).run();
	expect((await request(`${path}/archive`, 'POST', { version: 2 }, cookie)).status).toBe(409);
	await env.DB.prepare("UPDATE homework SET state='completed'").run();
	expect((await request(`${path}/archive`, 'POST', { version: 2 }, cookie)).status).toBe(200);
	expect(await (await request('/problems', 'GET', undefined, cookie)).json()).toMatchObject({ items: [] });
	expect(await (await request(path, 'GET', undefined, cookie)).json()).toMatchObject({ title: 'Updated' });
});

it('bounds pagination and applies combined filters', async () => {
	await request('/problems', 'POST', input, cookie);
	await request('/problems', 'POST', { ...input, url: 'https://leetcode.com/problems/three-sum/', difficulty: 'medium' }, cookie);
	const page = await (await request('/problems?limit=1', 'GET', undefined, cookie)).json() as { nextOffset: number };
	expect(page.nextOffset).toBe(1);
	expect(await (await request('/problems?limit=1&offset=1', 'GET', undefined, cookie)).json()).toMatchObject({ nextOffset: null });
	expect(await (await request('/problems?difficulty=hard&topic=Arrays', 'GET', undefined, cookie)).json()).toMatchObject({ items: [] });
	expect((await request('/problems?limit=51', 'GET', undefined, cookie)).status).toBe(400);
	expect((await request('/problems?due=2026-02-30', 'GET', undefined, cookie)).status).toBe(400);
});
