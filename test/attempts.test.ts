import { env } from 'cloudflare:workers';
import { beforeEach, expect, it } from 'vitest';
import { login, request } from './client';

let cookie: string, problemId: string, attemptId: string, path: string;
const approach = { id: '11111111-1111-4111-8111-111111111111', label: 'Counting', idea: 'Count the needed values.', correctness: '', timeComplexity: '', spaceComplexity: '', edgeCases: '', mistakes: '', language: 'Python', code: '  return count\n' };
const document = { notes: '', approaches: [approach] };
const value = { document, acceptance: 'accepted', understanding: 'with_help', version: 1 };
beforeEach(async () => {
	cookie = await login();
	const problem = await request('/problems', 'POST', { url: 'https://leetcode.com/problems/two-sum/', number: 1, title: 'Two Sum', difficulty: 'easy', topics: [], summary: '' }, cookie);
	problemId = (await problem.json() as { id: string }).id;
	attemptId = crypto.randomUUID();
	path = `/problems/${problemId}/attempts/${attemptId}`;
	await env.DB.prepare("INSERT INTO attempts (id,problem_id,state,document,search_text,acceptance,understanding,created_at,updated_at) VALUES (?,?,'draft',?,'','accepted','with_help','now','now')").bind(attemptId, problemId, JSON.stringify(document)).run();
});

it.each([
	{ name: 'fresh draft update', state: 'draft', storedVersion: 1, sentVersion: 1, expected: 200, finalVersion: 2 },
	{ name: 'stale draft update', state: 'draft', storedVersion: 2, sentVersion: 1, expected: 409, finalVersion: 2 },
	{ name: 'saved attempt update', state: 'saved', storedVersion: 1, sentVersion: 1, expected: 409, finalVersion: 1 },
])('$name', async ({ state, storedVersion, sentVersion, expected, finalVersion }) => {
	await env.DB.prepare('UPDATE attempts SET state=?,version=?').bind(state, storedVersion).run();
	const response = await request(path, 'PUT', { ...value, version: sentVersion, document: { ...document, notes: 'New note' } }, cookie);
	expect(response.status).toBe(expected);
	const row = await env.DB.prepare('SELECT version,document FROM attempts WHERE id=?').bind(attemptId).first<{ version: number; document: string }>();
	expect(row!.version).toBe(finalVersion);
	expect(JSON.parse(row!.document).notes).toBe(expected === 200 ? 'New note' : '');
});

it.each([
	{ name: 'zero approaches', count: 0, expected: 400 },
	{ name: 'eight approaches', count: 8, expected: 200 },
	{ name: 'nine approaches', count: 9, expected: 400 },
	{ name: 'duplicate approach IDs', count: 2, duplicate: true, expected: 400 },
])('$name', async ({ count, duplicate, expected }) => {
	const approaches = Array.from({ length: count }, () => ({ ...approach, id: duplicate ? approach.id : crypto.randomUUID() }));
	expect((await request(path, 'PUT', { ...value, document: { notes: '', approaches } }, cookie)).status).toBe(expected);
});

it.each([
	{ name: 'exact document boundary', extra: 0, multibyte: false, expected: 200 },
	{ name: 'one byte over document boundary', extra: 1, multibyte: false, expected: 413 },
	{ name: 'multibyte overflow', extra: 1, multibyte: true, expected: 413 },
])('$name', async ({ extra, multibyte, expected }) => {
	const remaining = 256_000 - new TextEncoder().encode(JSON.stringify(document)).length;
	const notes = multibyte ? 'я'.repeat(Math.ceil(remaining / 2) + extra) : 'x'.repeat(remaining + extra);
	expect((await request(path, 'PUT', { ...value, document: { ...document, notes } }, cookie)).status).toBe(expected);
});

it.each([
	{ name: 'non-string approach code', role: 'student', unknownProblem: false, code: 42, expected: 400 },
	{ name: 'parent draft edit', role: 'parent', unknownProblem: false, code: approach.code, expected: 403 },
	{ name: 'draft edit under an unknown problem', role: 'student', unknownProblem: true, code: approach.code, expected: 404 },
])('$name', async ({ role, unknownProblem, code, expected }) => {
	const target = unknownProblem ? `/problems/${crypto.randomUUID()}/attempts/${attemptId}` : path;
	const body = { ...value, document: { notes: '', approaches: [{ ...approach, code }] } };
	expect((await request(target, 'PUT', body, role === 'parent' ? await login('parent') : cookie)).status).toBe(expected);
});

it('saves history atomically and preserves the current reminder when omitted', async () => {
	await env.DB.prepare("UPDATE problems SET next_review_date='2026-10-20'").run();
	const saved = await request(`${path}/save`, 'POST', { version: 1 }, cookie);
	expect(saved.status).toBe(200);
	expect(await saved.json()).toMatchObject({ state: 'saved', version: 2, document });
	const progress = await (await request(`/problems/${problemId}`, 'GET', undefined, cookie)).json();
	expect(progress).toMatchObject({ solved: true, understanding: 'with_help', nextReviewDate: '2026-10-20', version: 1, progressVersion: 2 });
	expect((await request(`${path}/save`, 'POST', { version: 1, nextReviewDate: null }, cookie)).status).toBe(409);
	expect(await (await request(`/problems/${problemId}`, 'GET', undefined, cookie)).json()).toEqual(progress);
});

it('copies saved history into a new draft and reports an existing draft', async () => {
	await request(`${path}/save`, 'POST', { version: 1 }, cookie);
	const copy = await request(`/problems/${problemId}/attempts`, 'POST', { copyAttemptId: attemptId }, cookie);
	expect(copy.status).toBe(201);
	const record = await copy.json() as { id: string; document: typeof document };
	expect(record.id).not.toBe(attemptId);
	expect(record.document.approaches[0].id).not.toBe(approach.id);
	expect(record.document.approaches[0].code).toBe('  return count\n');
	const again = await request(`/problems/${problemId}/attempts`, 'POST', { copyAttemptId: attemptId }, cookie);
	expect(again.status).toBe(409);
	expect(await again.json()).toMatchObject({ error: { fields: { attemptId: record.id } } });
});

it.each([
	{ name: 'copied draft hides JSON keys from search', q: 'timecomplexity', found: false },
	{ name: 'copied draft hides code from search', q: 'return', found: false },
	{ name: 'copied draft finds the key idea', q: 'needed values', found: true },
])('$name', async ({ q, found }) => {
	expect((await request(`${path}/save`, 'POST', { version: 1 }, cookie)).status).toBe(200);
	expect((await request(`/problems/${problemId}/attempts`, 'POST', { copyAttemptId: attemptId }, cookie)).status).toBe(201);
	const response = await request(`/problems?${new URLSearchParams({ q })}`, 'GET', undefined, cookie);
	expect(await response.json()).toMatchObject({ items: found ? [{ id: problemId }] : [] });
});

it.each([
	{ name: 'save of a missing attempt', suffix: `/attempts/${crypto.randomUUID()}/save`, body: { version: 1 }, expected: 404 },
	{ name: 'new draft while a draft exists', suffix: '/attempts', body: {}, expected: 409 },
])('$name', async ({ suffix, body, expected }) => {
	expect((await request(`/problems/${problemId}${suffix}`, 'POST', body, cookie)).status).toBe(expected);
});
