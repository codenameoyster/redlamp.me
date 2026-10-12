import { env } from 'cloudflare:workers';
import { beforeEach, expect, it } from 'vitest';
import { login, request } from './client';
import type { ProblemTests } from '../shared/leetcode';

let cookie: string;
beforeEach(async () => { cookie = await login(); });
const insertProblem = env.DB.prepare("INSERT INTO problems (id,slug,title,difficulty,topics,summary,search_text,created_at,updated_at) VALUES (?,?,'Problem','medium','[]','','','now','now')");

it.each([
	{ name: 'LeetCode task of a set', slug: 'two-sum-ii-input-array-is-sorted', body: { spec: { mode: 'call', method: 'twoSum' }, source: 'set', standard: expect.arrayContaining([{ input: '[[2,7,11,15],9]', expected: '[1,2]' }]), own: [] } },
	{ name: 'Codeforces task of a set', slug: 'cf-1821-a', body: { spec: { mode: 'stdio' }, source: 'set', standard: expect.arrayContaining([{ input: '8\n??\n?\n0\n9\n03\n1??7\n?5?\n9??99\n', expected: '90\n9\n0\n1\n0\n100\n90\n100\n' }]), own: [] } },
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
	{ name: 'own test of an unknown problem', method: 'POST', status: 404 },
	{ name: 'change of the standard tests', method: 'PUT', status: 405 },
])('$name', async ({ method, status }) => {
	expect((await request(`/problems/${crypto.randomUUID()}/tests`, method, method === 'GET' ? undefined : {}, cookie)).status).toBe(status);
});

const ownTest = { input: '[[3, 3], 6]', expected: '[0, 1]' };
const insertOwn = env.DB.prepare("INSERT INTO problem_tests (id,problem_id,input,expected,created_at) VALUES (?,?,'1','1','2026-10-01T10:00:00.000Z')");
it.each([
	{ name: 'student adds an own test', role: 'student', stored: 0, body: ownTest, status: 201, count: 1, fields: ownTest },
	{ name: 'parent adds an own test', role: 'parent', stored: 0, body: ownTest, status: 201, count: 1, fields: ownTest },
	{ name: 'twentieth own test', role: 'student', stored: 19, body: ownTest, status: 201, count: 20, fields: ownTest },
	{ name: 'twenty-first own test', role: 'student', stored: 20, body: ownTest, status: 409, count: 20, fields: { error: { code: 'too_many_tests' } } },
	{ name: 'input at 10,000 characters', role: 'student', stored: 0, body: { input: '1'.repeat(10_000), expected: '1' }, status: 201, count: 1, fields: { input: '1'.repeat(10_000) } },
	{ name: 'input over 10,000 characters', role: 'student', stored: 0, body: { input: '1'.repeat(10_001), expected: '1' }, status: 400, count: 0, fields: { error: { code: 'invalid_input' } } },
	{ name: 'expected over 10,000 characters', role: 'student', stored: 0, body: { input: '1', expected: '1'.repeat(10_001) }, status: 400, count: 0, fields: { error: { code: 'invalid_input' } } },
	{ name: 'blank input', role: 'student', stored: 0, body: { input: ' \n', expected: '1' }, status: 400, count: 0, fields: { error: { code: 'invalid_input' } } },
	{ name: 'blank expected', role: 'student', stored: 0, body: { input: '1', expected: ' ' }, status: 400, count: 0, fields: { error: { code: 'invalid_input' } } },
	{ name: 'expected of null', role: 'student', stored: 0, body: { input: '1', expected: null }, status: 400, count: 0, fields: { error: { code: 'invalid_input' } } },
	{ name: 'unknown field', role: 'student', stored: 0, body: { ...ownTest, name: 'Test' }, status: 400, count: 0, fields: { error: { code: 'invalid_input' } } },
])('$name', async ({ role, stored, body, status, count, fields }) => {
	const id = crypto.randomUUID();
	await insertProblem.bind(id, 'two-sum').run();
	for (let index = 0; index < stored; index++) await insertOwn.bind(crypto.randomUUID(), id).run();
	const response = await request(`/problems/${id}/tests`, 'POST', body, role === 'parent' ? await login('parent') : cookie);
	expect(response.status).toBe(status);
	const created = await response.json();
	expect(created).toMatchObject(fields);
	expect(await env.DB.prepare('SELECT count(*) AS count FROM problem_tests').first()).toEqual({ count });
	// The runner numbers the own tests after the standard tests in the order of creation.
	if (status === 201) expect((await (await request(`/problems/${id}/tests`, 'GET', undefined, cookie)).json() as ProblemTests).own.at(-1)).toEqual(created);
});

it.each([
	{ name: 'delete an own test', owner: 'same', target: 'stored', status: 204, count: 0 },
	{ name: 'delete an own test of another problem', owner: 'other', target: 'stored', status: 404, count: 1 },
	{ name: 'delete an unknown own test', owner: 'same', target: 'unknown', status: 404, count: 1 },
])('$name', async ({ owner, target, status, count }) => {
	const id = crypto.randomUUID(), other = crypto.randomUUID(), stored = crypto.randomUUID();
	await env.DB.batch([insertProblem.bind(id, 'two-sum'), insertProblem.bind(other, 'cf-1-a'), insertOwn.bind(stored, id)]);
	const response = await request(`/problems/${owner === 'same' ? id : other}/tests/${target === 'stored' ? stored : crypto.randomUUID()}`, 'DELETE', undefined, cookie);
	expect(response.status).toBe(status);
	expect(await env.DB.prepare('SELECT count(*) AS count FROM problem_tests').first()).toEqual({ count });
});
