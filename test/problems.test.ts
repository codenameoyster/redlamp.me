import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Page, Problem } from '../shared/leetcode';
import { login, request } from './client';

let cookie: string;
const addTask = (problemId: string, state: string) => env.DB.batch([
	env.DB.prepare("INSERT INTO homework (id,title,instructions,created_at,updated_at) VALUES ('77777777-7777-4777-8777-777777777777','Week 41','Explain','now','now')"),
	env.DB.prepare("INSERT INTO homework_tasks (id,homework_id,problem_id,state,created_at,updated_at) VALUES (?,'77777777-7777-4777-8777-777777777777',?,?,'now','now')").bind(crypto.randomUUID(), problemId, state),
]);
const input = { url: 'https://leetcode.com/problems/two-sum/', number: 1, title: 'Two Sum', difficulty: 'easy', topics: ['Arrays'], summary: '' };
beforeEach(async () => { cookie = await login(); });
afterEach(() => { vi.restoreAllMocks(); });

const twoSum = { slug: 'two-sum', url: 'https://leetcode.com/problems/two-sum/' }, theatreSquare = { slug: 'cf-1-a', url: 'https://codeforces.com/problemset/problem/1/A' };
it.each([
	{ name: 'canonical link', url: 'https://leetcode.com/problems/two-sum/', expected: twoSum },
	{ name: 'description link', url: 'https://leetcode.com/problems/two-sum/description/?envType=daily-question#notes', expected: twoSum },
	{ name: 'foreign host', url: 'https://leetcode.com.evil.example/problems/two-sum/', expected: null },
	{ name: 'missing slug', url: 'https://leetcode.com/problems/', expected: null },
	{ name: 'insecure URL', url: 'http://leetcode.com/problems/two-sum/', expected: null },
	{ name: 'URL with credentials', url: 'https://user@leetcode.com/problems/two-sum/', expected: null },
	{ name: 'problemset form', url: 'https://codeforces.com/problemset/problem/1/A', expected: theatreSquare },
	{ name: 'contest form', url: 'https://codeforces.com/contest/1/problem/A', expected: theatreSquare },
	{ name: 'lower case index', url: 'https://codeforces.com/problemset/problem/1/a', expected: theatreSquare },
	{ name: 'index with digit', url: 'https://codeforces.com/contest/1234/problem/b1', expected: { slug: 'cf-1234-b1', url: 'https://codeforces.com/problemset/problem/1234/B1' } },
	{ name: 'codeforces http', url: 'http://codeforces.com/problemset/problem/1/A', expected: null },
	{ name: 'codeforces missing index', url: 'https://codeforces.com/problemset/problem/1', expected: null },
	{ name: 'codeforces extra path', url: 'https://codeforces.com/problemset/problem/1/A/?locale=ru#statement', expected: theatreSquare },
])('$name', async ({ url, expected }) => {
	const response = await request('/problems', 'POST', { ...input, url }, cookie);
	expect(response.status).toBe(expected === null ? 400 : 201);
	if (expected) expect(await response.json()).toMatchObject(expected);
});

it('returns the existing problem for a duplicate URL', async () => {
	const first = await (await request('/problems', 'POST', input, cookie)).json();
	const second = await request('/problems', 'POST', { ...input, url: `${input.url}description/` }, cookie);
	expect(second.status).toBe(200);
	expect(await second.json()).toEqual(first);
	expect(await env.DB.prepare('SELECT count(*) AS count FROM problems').first()).toEqual({ count: 1 });
});

it.each([
	{ name: 'manual aliases', slug: 'two-sum', values: ['HashTable', 'Хеш-таблица', 'Массивы'], expected: ['Hash Table', 'Array'] },
	{ name: 'Backtracking context', slug: 'subsets', values: ['Перебор', 'Backtracking'], expected: ['Backtracking'] },
	{ name: 'Dynamic Programming context', slug: 'unique-paths', values: ['Таблица', 'Сочетания'], expected: ['Dynamic Programming', 'Combinations'] },
	{ name: 'new English topic', slug: 'custom-problem', values: ['Custom Technique'], expected: ['Custom Technique'] },
])('stores canonical topics for $name', async ({ slug, values, expected }) => {
	const response = await request('/problems', 'POST', { ...input, url: `https://leetcode.com/problems/${slug}/`, topics: values }, cookie);
	expect(response.status).toBe(201);
	const problem = await response.json() as Problem;
	expect(problem.topics).toEqual(expected);
	expect(await env.DB.prepare('SELECT topics,search_text FROM problems WHERE id=?').bind(problem.id).first()).toEqual({ topics: JSON.stringify(expected), search_text: `two sum 1 ${expected.join(' ').toLowerCase()} ` });
});

it('normalizes a metadata edit and preserves saved work and progress', async () => {
	const problem = await (await request('/problems', 'POST', input, cookie)).json() as Problem;
	const summary = 'Моя Хеш-таблица', document = JSON.stringify({ notes: 'Перебор и Таблица', approaches: [] });
	await env.DB.batch([
		env.DB.prepare("UPDATE problems SET topics='[\"Хеш-таблица\"]',summary=?,progress_version=7,understanding='with_help',next_review_date='2026-11-01' WHERE id=?").bind(summary, problem.id),
		env.DB.prepare("INSERT INTO attempts (id,problem_id,state,document,search_text,acceptance,understanding,created_at,updated_at) VALUES (?,?,'saved',?,'перебор и таблица','accepted','with_help','now','now')").bind(crypto.randomUUID(), problem.id, document),
		env.DB.prepare("INSERT INTO reviews (id,problem_id,result,note,reviewed_on,created_at) VALUES (?,?,'with_help','Таблица','2026-10-27','now')").bind(crypto.randomUUID(), problem.id),
	]);
	await addTask(problem.id, 'completed');
	const attempts = (await env.DB.prepare('SELECT * FROM attempts').all()).results, reviews = (await env.DB.prepare('SELECT * FROM reviews').all()).results, tasks = (await env.DB.prepare('SELECT * FROM homework_tasks').all()).results;
	const response = await request(`/problems/${problem.id}`, 'PATCH', { ...input, topics: ['HashTable', 'Массив', 'Хеш-таблица'], summary, version: 1 }, cookie);
	expect(response.status).toBe(200);
	expect(await response.json()).toMatchObject({ id: problem.id, slug: 'two-sum', number: 1, version: 2, progressVersion: 7, solved: true, understanding: 'with_help', nextReviewDate: '2026-11-01', createdAt: problem.createdAt, summary, topics: ['Hash Table', 'Array'] });
	expect(await env.DB.prepare('SELECT topics,search_text FROM problems WHERE id=?').bind(problem.id).first()).toEqual({ topics: '["Hash Table","Array"]', search_text: 'two sum 1 hash table array моя хеш-таблица' });
	expect((await env.DB.prepare('SELECT * FROM attempts').all()).results).toEqual(attempts);
	expect((await env.DB.prepare('SELECT * FROM reviews').all()).results).toEqual(reviews);
	expect((await env.DB.prepare('SELECT * FROM homework_tasks').all()).results).toEqual(tasks);
});

it.each([
	{ name: 'single problem read', action: 'read', version: 1, archived: false },
	{ name: 'library read', action: 'list', version: 1, archived: false },
	{ name: 'duplicate URL', action: 'duplicate', version: 1, archived: false },
	{ name: 'archive response', action: 'archive', version: 2, archived: false },
	{ name: 'restore response', action: 'restore', version: 2, archived: true },
])('normalizes legacy topics in $name', async ({ action, version, archived }) => {
	const problem = await (await request('/problems', 'POST', input, cookie)).json() as Problem;
	const stored = '["HashTable","Хеш-таблица","Hash Table","Особая тема"]';
	await env.DB.prepare("UPDATE problems SET topics=?,summary='Мои заметки',progress_version=8,understanding='independent',next_review_date='2026-11-01',archived_at=? WHERE id=?").bind(stored, archived ? 'now' : null, problem.id).run();
	const path = `/problems/${problem.id}`;
	const response = action === 'list' ? await request('/problems', 'GET', undefined, cookie) : action === 'duplicate' ? await request('/problems', 'POST', input, cookie) : action === 'read' ? await request(path, 'GET', undefined, cookie) : await request(`${path}/${action}`, 'POST', { version: 1 }, cookie);
	expect(response.status).toBe(200);
	const body = await response.json();
	expect(action === 'list' ? (body as Page<Problem>).items[0] : body).toMatchObject({ id: problem.id, slug: 'two-sum', version, progressVersion: 8, understanding: 'independent', nextReviewDate: '2026-11-01', createdAt: problem.createdAt, summary: 'Мои заметки', topics: ['Hash Table', 'Особая тема'] });
	expect(await env.DB.prepare('SELECT topics FROM problems WHERE id=?').bind(problem.id).first()).toEqual({ topics: stored });
});

it.each([
	{ name: 'POST rejects a new non-English topic', method: 'POST', query: '', values: ['Особая тема'] },
	{ name: 'PATCH rejects a new non-English topic', method: 'PATCH', query: '', values: ['Особая тема'] },
	{ name: 'topic filter needs unambiguous context', method: 'GET', query: `?${new URLSearchParams({ topic: 'Перебор' })}`, values: [] },
])('$name', async ({ method, query, values }) => {
	const problem = await (await request('/problems', 'POST', input, cookie)).json() as Problem;
	const response = await request(`/problems${method === 'PATCH' ? `/${problem.id}` : query}`, method, method === 'GET' ? undefined : { ...input, topics: values, ...(method === 'PATCH' ? { version: 1 } : {}) }, cookie);
	expect(response.status).toBe(400);
	expect(await response.json()).toMatchObject({ error: { code: 'invalid_input', message: 'Укажите название темы на английском языке.' } });
});

it.each<{ name: string; query: Record<string, string>; slugs: string[]; nextOffset: number | null }>([
	{ name: 'canonical topic on the first page', query: { topic: 'Hash Table', limit: '1' }, slugs: ['legacy-first'], nextOffset: 1 },
	{ name: 'Russian alias on the second page', query: { topic: 'Хеш-таблица', limit: '1', offset: '1' }, slugs: ['mixed'], nextOffset: 2 },
	{ name: 'compact alias on the last page', query: { topic: 'HashTable', limit: '2', offset: '2' }, slugs: ['canonical', 'legacy-last'], nextOffset: null },
	{ name: 'topic case and whitespace', query: { topic: ' hash  TABLE ' }, slugs: ['legacy-first', 'mixed', 'canonical', 'legacy-last'], nextOffset: null },
	{ name: 'canonical text finds legacy metadata', query: { q: 'HASH TABLE', limit: '1' }, slugs: ['legacy-first'], nextOffset: 1 },
	{ name: 'canonical text on the last page', query: { q: 'Hash Table', limit: '1', offset: '3' }, slugs: ['legacy-last'], nextOffset: null },
	{ name: 'raw metadata text stays searchable', query: { q: 'HashTable' }, slugs: ['legacy-first', 'mixed'], nextOffset: null },
	{ name: 'topic and scalar filters before pagination', query: { topic: 'HashTable', difficulty: 'medium', understanding: 'independent', due: '2026-10-27', limit: '1', offset: '1' }, slugs: ['legacy-last'], nextOffset: null },
	{ name: 'literal attempt text and topic filter', query: { topic: 'Hash Table', q: 'МОЯ ХЕШ-ТАБЛИЦА 100%_READY' }, slugs: ['legacy-last'], nextOffset: null },
	{ name: 'canonical metadata respects topic filter', query: { topic: 'Array', q: 'Hash Table' }, slugs: [], nextOffset: null },
	{ name: 'archived canonical text', query: { archived: '1', q: 'Hash Table' }, slugs: ['archived'], nextOffset: null },
])('filters $name', async ({ query, slugs, nextOffset }) => {
	const rows = [
		{ name: 'last legacy match', slug: 'legacy-last', topics: ['Хеш-таблица'], date: '2026-10-01', difficulty: 'medium', understanding: 'independent', archived: null },
		{ name: 'canonical match', slug: 'canonical', topics: ['Hash Table'], date: '2026-10-02', difficulty: 'easy', understanding: 'independent', archived: null },
		{ name: 'several aliases on one problem', slug: 'mixed', topics: ['HashTable', 'Хеш-таблица', 'Hash Table'], date: '2026-10-03', difficulty: 'medium', understanding: 'with_help', archived: null },
		{ name: 'first legacy match', slug: 'legacy-first', topics: ['HashTable'], date: '2026-10-04', difficulty: 'medium', understanding: 'independent', archived: null },
		{ name: 'newer unrelated problem', slug: 'unrelated', topics: ['Array'], date: '2026-10-05', difficulty: 'medium', understanding: 'independent', archived: null },
		{ name: 'archived legacy match', slug: 'archived', topics: ['Хеш-таблица'], date: '2026-10-06', difficulty: 'medium', understanding: 'independent', archived: 'now' },
	];
	for (const row of rows) {
		const id = crypto.randomUUID();
		await env.DB.prepare("INSERT INTO problems (id,slug,title,difficulty,topics,summary,search_text,understanding,next_review_date,archived_at,created_at,updated_at) VALUES (?,?,?, ?,?,'',?,?,'2026-10-20',?,'now',?)").bind(id, row.slug, row.name, row.difficulty, JSON.stringify(row.topics), row.topics.join(' ').toLowerCase(), row.understanding, row.archived, row.date).run();
		if (row.slug === 'legacy-last' || row.slug === 'unrelated') await env.DB.prepare("INSERT INTO attempts (id,problem_id,state,document,search_text,acceptance,understanding,created_at,updated_at) VALUES (?,?,'draft','{}',?,'not_submitted','needs_practice','now','now')").bind(crypto.randomUUID(), id, row.slug === 'legacy-last' ? 'моя хеш-таблица 100%_ready' : 'моя хеш-таблица 100xready').run();
	}
	const response = await request(`/problems?${new URLSearchParams(query)}`, 'GET', undefined, cookie);
	expect(response.status).toBe(200);
	const body = await response.json() as Page<Problem>;
	expect(body.items.map(problem => problem.slug)).toEqual(slugs);
	expect(body.nextOffset).toBe(nextOffset);
	expect(body.items.every(problem => problem.topics.length === 1 && problem.topics[0] === 'Hash Table')).toBe(true);
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

const moveZeroes = 'https://leetcode.com/problems/move-zeroes/';
const insertAttempt = env.DB.prepare("INSERT INTO attempts (id,problem_id,state,document,search_text,acceptance,understanding,created_at,updated_at) VALUES (?,?,?,'{}','',?,'independent','now','now')");
it.each([
	{ name: 'unassigned problem', task: null, attempt: null, available: true },
	{ name: 'assigned problem', task: 'assigned', attempt: null, available: false },
	{ name: 'problem in progress', task: 'in_progress', attempt: null, available: false },
	{ name: 'submitted problem', task: 'submitted', attempt: null, available: false },
	{ name: 'problem returned for changes', task: 'changes_requested', attempt: null, available: false },
	{ name: 'completed problem without acceptance', task: 'completed', attempt: null, available: false },
	{ name: 'cancelled unsolved problem', task: 'cancelled', attempt: null, available: true },
	{ name: 'accepted problem without homework', task: null, attempt: 'saved', available: false },
	{ name: 'accepted problem with cancelled homework', task: 'cancelled', attempt: 'saved', available: false },
	{ name: 'draft acceptance is not a solved problem', task: null, attempt: 'draft', available: true },
])('homework picker filters $name', async ({ task, attempt, available }) => {
	const problem = await (await request('/problems', 'POST', input, cookie)).json() as { id: string };
	if (task) await addTask(problem.id, task);
	if (attempt) await insertAttempt.bind(crypto.randomUUID(), problem.id, attempt, 'accepted').run();
	const response = await request('/problems?assignable=1&q=Two', 'GET', undefined, cookie);
	expect(response.status).toBe(200);
	expect((await response.json() as { items: { id: string }[] }).items.map(item => item.id)).toEqual(available ? [problem.id] : []);
	expect((await (await request('/problems', 'GET', undefined, cookie)).json() as { items: unknown[] }).items).toHaveLength(1);
});

it.each([
	{ name: 'URL change of a problem without work', attempt: null, task: null, url: moveZeroes, status: 200, slug: 'move-zeroes' },
	{ name: 'URL change of a problem with a draft', attempt: 'draft', task: null, url: moveZeroes, status: 200, slug: 'move-zeroes' },
	{ name: 'URL change of a problem with an accepted attempt', attempt: 'accepted', task: null, url: moveZeroes, status: 409, slug: 'two-sum' },
	{ name: 'URL change of a problem with an assigned task', attempt: null, task: 'assigned', url: moveZeroes, status: 409, slug: 'two-sum' },
	{ name: 'URL change of a problem with a completed task', attempt: null, task: 'completed', url: moveZeroes, status: 409, slug: 'two-sum' },
	{ name: 'URL change of a problem with a cancelled task', attempt: null, task: 'cancelled', url: moveZeroes, status: 200, slug: 'move-zeroes' },
	{ name: 'other form of the same URL of a problem with an accepted attempt', attempt: 'accepted', task: null, url: `${input.url}description/`, status: 200, slug: 'two-sum' },
])('$name', async ({ attempt, task, url, status, slug }) => {
	const problem = await (await request('/problems', 'POST', input, cookie)).json() as { id: string };
	if (attempt) await insertAttempt.bind(crypto.randomUUID(), problem.id, attempt === 'draft' ? 'draft' : 'saved', attempt === 'draft' ? 'not_submitted' : 'accepted').run();
	if (task) await addTask(problem.id, task);
	const response = await request(`/problems/${problem.id}`, 'PATCH', { ...input, url, version: 1, title: 'Updated' }, cookie);
	expect(response.status).toBe(status);
	if (status === 409) expect(await response.json()).toMatchObject({ error: { code: 'slug_locked' } });
	expect(await (await request(`/problems/${problem.id}`, 'GET', undefined, cookie)).json()).toMatchObject({ slug, title: status === 200 ? 'Updated' : input.title });
});

it('archives a problem after its active homework completes', async () => {
	const problem = await (await request('/problems', 'POST', input, cookie)).json() as { id: string };
	const path = `/problems/${problem.id}`;
	await addTask(problem.id, 'assigned');
	expect((await request(`${path}/archive`, 'POST', { version: 1 }, cookie)).status).toBe(409);
	await env.DB.prepare("UPDATE homework_tasks SET state='completed'").run();
	expect((await request(`${path}/archive`, 'POST', { version: 1 }, cookie)).status).toBe(200);
	expect(await (await request('/problems', 'GET', undefined, cookie)).json()).toMatchObject({ items: [] });
	expect(await (await request(path, 'GET', undefined, cookie)).json()).toMatchObject({ title: input.title });
});

it.each([
	{ name: 'archive with active homework', action: 'archive', archivedAt: null, homework: 'assigned', stored: 1, error: { code: 'active_homework', message: 'Завершите или отмените активное задание, прежде чем отправлять задачу в архив.' } },
	{ name: 'stale archive', action: 'archive', archivedAt: null, homework: 'completed', stored: 2, error: { code: 'conflict' } },
	{ name: 'stale restore', action: 'restore', archivedAt: 'now', homework: 'completed', stored: 2, error: { code: 'conflict' } },
])('$name', async ({ action, archivedAt, homework, stored, error }) => {
	const problem = await (await request('/problems', 'POST', input, cookie)).json() as { id: string };
	await env.DB.prepare('UPDATE problems SET archived_at=?,version=?').bind(archivedAt, stored).run();
	await addTask(problem.id, homework);
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
	const homework = await (await request('/homework', 'POST', { title: 'Week 41', instructions: '', dueDate: null }, parent)).json() as { id: string };
	expect((await request('/tasks', 'POST', { homeworkId: homework.id, problemId: problem.id }, parent)).status).toBe(201);
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
	{ name: 'details normalize aliases and retain new English topics', url: 'https://leetcode.com/problems/two-sum/', reply: () => Response.json({ data: { question: { ...question, topicTags: [{ name: 'HashTable' }, { name: 'Хеш-таблица' }, { name: 'Arrays' }, { name: 'Custom Technique' }] } } }), status: 200, body: { topics: ['Hash Table', 'Array', 'Custom Technique'] }, slug: 'two-sum' },
	{ name: 'unknown LeetCode problem', url: 'https://leetcode.com/problems/two-sum/', reply: () => Response.json({ data: { question: null } }), status: 404, body: { error: { code: 'not_found' } }, slug: 'two-sum' },
	{ name: 'LeetCode error response', url: 'https://leetcode.com/problems/two-sum/', reply: () => new Response('Busy', { status: 503 }), status: 502, body: { error: { code: 'lookup_failed' } }, slug: 'two-sum' },
	{ name: 'unreachable LeetCode', url: 'https://leetcode.com/problems/two-sum/', reply: () => { throw new TypeError('Network connection lost.'); }, status: 502, body: { error: { code: 'lookup_failed' } }, slug: 'two-sum' },
	{ name: 'details for a URL outside LeetCode', url: 'https://example.com/problems/two-sum/', reply: () => Response.json({}), status: 400, body: { error: { code: 'invalid_url' } }, slug: null },
	{ name: 'details for a Codeforces URL', url: 'https://codeforces.com/problemset/problem/1/A', reply: () => Response.json({}), status: 400, body: { error: { code: 'lookup_unavailable' } }, slug: null },
])('$name', async ({ url, reply, status, body, slug }) => {
	const leetcode = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => reply());
	const response = await request(`/problem-details?url=${encodeURIComponent(url)}`, 'GET', undefined, cookie);
	expect(response.status).toBe(status);
	expect(await response.json()).toMatchObject(body);
	expect(leetcode.mock.calls.map(([target, init]) => [String(target), JSON.parse(String(init?.body)).variables.titleSlug])).toEqual(slug ? [['https://leetcode.com/graphql', slug]] : []);
});
