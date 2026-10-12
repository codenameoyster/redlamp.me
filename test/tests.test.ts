import { env } from 'cloudflare:workers';
import { beforeEach, expect, it } from 'vitest';
import { login, request } from './client';

let cookie: string;
beforeEach(async () => { cookie = await login(); });
const insertProblem = env.DB.prepare("INSERT INTO problems (id,slug,title,difficulty,topics,summary,search_text,created_at,updated_at) VALUES (?,?,'Problem','medium','[]','','','now','now')");

it.each([
	{ name: 'LeetCode task of a set', slug: 'two-sum-ii-input-array-is-sorted', body: { spec: null, source: 'set', standard: [], own: [] } },
	{ name: 'Codeforces task of a set', slug: 'cf-1821-a', body: { spec: { mode: 'stdio' }, source: 'set', standard: [], own: [] } },
	{ name: 'Codeforces problem outside the sets', slug: 'cf-1-a', body: { spec: { mode: 'stdio' }, source: 'none', standard: [], own: [] } },
	{ name: 'LeetCode problem outside the sets', slug: 'two-sum', body: { spec: null, source: 'none', standard: [], own: [] } },
])('$name', async ({ slug, body }) => {
	const id = crypto.randomUUID();
	await insertProblem.bind(id, slug).run();
	const response = await request(`/problems/${id}/tests`, 'GET', undefined, cookie);
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual(body);
});

it.each([
	{ name: 'unknown problem', method: 'GET', status: 404 },
	{ name: 'change of the standard tests', method: 'PUT', status: 405 },
])('$name', async ({ method, status }) => {
	expect((await request(`/problems/${crypto.randomUUID()}/tests`, method, method === 'GET' ? undefined : {}, cookie)).status).toBe(status);
});
