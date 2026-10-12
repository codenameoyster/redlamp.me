import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as dates from '../shared/dates';
import type { Dashboard, Problem } from '../shared/leetcode';
import { login, request } from './client';
import { spreadDays } from '../src/leetcode/reviews';

let cookie: string, first: string, taskId: string, homeworkId: string;
beforeEach(async () => {
	cookie = await login();
	const cases = [
		{ name: 'accepted independently', slug: 'one', topics: ['Arrays'], acceptance: 'accepted', understanding: 'independent' },
		{ name: 'accepted with help', slug: 'two', topics: ['Arrays', 'Graphs'], acceptance: 'accepted', understanding: 'with_help' },
		{ name: 'unaccepted independently', slug: 'three', topics: ['Graphs'], acceptance: 'not_accepted', understanding: 'independent' },
	];
	for (const row of cases) {
		const id = crypto.randomUUID(); if (row.slug === 'one') first = id;
		await env.DB.prepare('INSERT INTO problems (id,slug,title,difficulty,topics,summary,search_text,understanding,next_review_date,created_at,updated_at) VALUES (?,?,?,\'medium\',?,\'\',\'\',?,\'2026-10-07\',\'now\',\'now\')').bind(id, row.slug, row.name, JSON.stringify(row.topics), row.understanding).run();
		await env.DB.prepare("INSERT INTO attempts (id,problem_id,state,document,search_text,acceptance,understanding,created_at,updated_at) VALUES (?,?,'saved','{}','',?,?,'now','now')").bind(crypto.randomUUID(), id, row.acceptance, row.understanding).run();
	}
	taskId = crypto.randomUUID(); homeworkId = crypto.randomUUID();
	await env.DB.batch([
		env.DB.prepare("INSERT INTO homework (id,title,instructions,due_date,created_at,updated_at) VALUES (?,'Week 41','Explain','2026-10-07','now','now')").bind(homeworkId),
		env.DB.prepare("INSERT INTO homework_tasks (id,homework_id,problem_id,state,created_at,updated_at) VALUES (?,?,?,'assigned','now','now')").bind(taskId, homeworkId, first),
	]);
});
afterEach(() => { vi.restoreAllMocks(); });

it.each([
	{ name: 'month boundary', date: '2026-01-31', days: 1, expected: '2026-02-01' },
	{ name: 'leap day', date: '2028-02-28', days: 1, expected: '2028-02-29' },
	{ name: 'year boundary', date: '2026-12-29', days: 7, expected: '2027-01-05' },
	{ name: 'daylight-saving calendar interval', date: '2026-03-07', days: 3, expected: '2026-03-10' },
])('$name', ({ date, days, expected }) => { expect(dates.addCalendarDays(date, days)).toBe(expected); });

it('counts accepted problems separately from current understanding', async () => {
	const dashboard = await request('/dashboard?today=2026-10-07', 'GET', undefined, cookie);
	expect(dashboard.status).toBe(200);
	expect(await dashboard.json()).toMatchObject({ counts: { recorded: 3, solved: 2, independent: 1 }, topics: [{ topic: 'Arrays', solved: 2, independent: 1 }, { topic: 'Graphs', solved: 1, independent: 0 }] });
	const value = { version: 1, result: 'needs_practice', note: 'Missed the invariant.', reviewedOn: '2026-10-07', nextReviewDate: '2026-10-08' };
	expect((await request(`/problems/${first}/reviews`, 'POST', value, cookie)).status).toBe(201);
	expect(await (await request('/dashboard?today=2026-10-07', 'GET', undefined, cookie)).json()).toMatchObject({ counts: { solved: 2, independent: 0 } });
	expect(await (await request(`/problems/${first}`, 'GET', undefined, cookie)).json()).toMatchObject({ solved: true, understanding: 'needs_practice', nextReviewDate: '2026-10-08' });
});

it.each([
	{ name: 'before due day', today: '2026-10-06', dueReviews: 0 },
	{ name: 'same-day revision', today: '2026-10-07', dueReviews: 3 },
	{ name: 'revision overdue the next day', today: '2026-10-08', dueReviews: 3 },
])('$name', async ({ today, dueReviews }) => {
	const response = await request(`/dashboard?today=${today}`, 'GET', undefined, cookie);
	expect(response.status).toBe(200);
	expect((await response.json() as Dashboard).counts).toEqual({ recorded: 3, solved: 2, independent: 1, waitingReview: 0, dueReviews, dueCards: 0 });
});

it.each([
	{ name: 'active task with its homework', state: 'assigned', rows: 1 },
	{ name: 'submitted task waits for review', state: 'submitted', rows: 1 },
	{ name: 'completed task leaves the dashboard', state: 'completed', rows: 0 },
	{ name: 'cancelled task leaves the dashboard', state: 'cancelled', rows: 0 },
])('$name', async ({ state, rows }) => {
	await env.DB.prepare('UPDATE homework_tasks SET state=?').bind(state).run();
	const { homework } = await (await request('/dashboard?today=2026-10-07', 'GET', undefined, cookie)).json() as Dashboard;
	expect(homework).toEqual([{ id: taskId, homeworkId, homeworkTitle: 'Week 41', instructions: 'Explain', dueDate: '2026-10-07', postponedTo: null, problemId: first, problemTitle: 'accepted independently', difficulty: 'medium', state, submissionId: null, version: 1, createdAt: 'now', updatedAt: 'now', unread: false }].slice(0, rows));
});

it.each([
	{ name: 'impossible day', today: '2026-02-30' },
	{ name: 'missing local date', today: '' },
	{ name: 'timestamp in place of date', today: '2026-10-07T00:00:00Z' },
])('$name', async ({ today }) => { expect((await request(`/dashboard?today=${today}`, 'GET', undefined, cookie)).status).toBe(400); });

it.each([
	{ name: 'parent review', role: 'parent', nextReviewDate: '2026-10-08', expected: 403 },
	{ name: 'impossible next review date', role: 'student', nextReviewDate: '2026-02-30', expected: 400 },
])('$name', async ({ role, nextReviewDate, expected }) => {
	const value = { version: 1, result: 'with_help', note: '', reviewedOn: '2026-10-07', nextReviewDate };
	expect((await request(`/problems/${first}/reviews`, 'POST', value, role === 'student' ? cookie : await login('parent'))).status).toBe(expected);
	expect(await env.DB.prepare('SELECT count(*) AS count FROM reviews').first()).toEqual({ count: 0 });
});

it.each([
	{ name: 'repeated accepted attempt counts one solved problem', change: 'attempt', counts: { recorded: 3, solved: 2, independent: 1, dueReviews: 3 } },
	{ name: 'archived problem leaves the counts', change: 'archive', counts: { recorded: 2, solved: 2, independent: 1, dueReviews: 2 } },
	{ name: 'submitted homework waits for review', change: 'submit', counts: { waitingReview: 1 } },
	{ name: 'archived problem hides submitted homework', change: 'submit archived', counts: { waitingReview: 0 } },
])('$name', async ({ change, counts }) => {
	if (change === 'attempt') await env.DB.prepare("INSERT INTO attempts (id,problem_id,state,document,search_text,acceptance,understanding,created_at,updated_at) VALUES (?,?,'saved','{}','','accepted','independent','now','now')").bind(crypto.randomUUID(), first).run();
	if (change === 'archive') await env.DB.prepare("UPDATE problems SET archived_at='now' WHERE slug='three'").run();
	if (change.startsWith('submit')) await env.DB.prepare("UPDATE homework_tasks SET state='submitted'").run();
	if (change === 'submit archived') await env.DB.prepare("UPDATE problems SET archived_at='now' WHERE id=?").bind(first).run();
	expect(await (await request('/dashboard?today=2026-10-07', 'GET', undefined, cookie)).json()).toMatchObject({ counts });
});

it.each([
	{ name: 'parent edit after a student save', earlier: 'save', later: 'edit', expected: 200, fields: { version: 2, progressVersion: 2 }, reviews: 0 },
	{ name: 'student review after a parent edit', earlier: 'edit', later: 'review', expected: 201, fields: { version: 2, progressVersion: 2, nextReviewDate: null }, reviews: 1 },
	{ name: 'second review with the same progress version', earlier: 'review', later: 'review', expected: 409, fields: { version: 1, progressVersion: 2 }, reviews: 1 },
	{ name: 'parent edit after the student marks a draft solved', earlier: 'solved', later: 'edit', expected: 200, fields: { version: 2, progressVersion: 2 }, reviews: 0 },
])('$name', async ({ earlier, later, expected, fields, reviews }) => {
	const draftId = crypto.randomUUID(), parent = await login('parent');
	await env.DB.prepare("INSERT INTO attempts (id,problem_id,state,document,search_text,acceptance,understanding,created_at,updated_at) VALUES (?,?,'draft',?,'','accepted','with_help','now','now')").bind(draftId, first, JSON.stringify({ notes: 'Explain the invariant.', approaches: [] })).run();
	const problem = await (await request(`/problems/${first}`, 'GET', undefined, cookie)).json() as Problem;
	const write = (kind: string) => kind === 'save' ? request(`/problems/${first}/attempts/${draftId}/save`, 'POST', { version: 1 }, cookie)
		: kind === 'solved' ? request(`/problems/${first}/solved`, 'POST', { attemptId: draftId }, cookie)
		: kind === 'edit' ? request(`/problems/${first}`, 'PATCH', { url: 'https://leetcode.com/problems/one/', number: null, title: 'Edited', difficulty: 'medium', topics: [], summary: '', version: problem.version }, parent)
		: request(`/problems/${first}/reviews`, 'POST', { version: problem.progressVersion, result: 'with_help', note: '', reviewedOn: '2026-10-07', nextReviewDate: null }, cookie);
	expect((await write(earlier)).ok).toBe(true);
	expect((await write(later)).status).toBe(expected);
	expect(await (await request(`/problems/${first}`, 'GET', undefined, cookie)).json()).toMatchObject(fields);
	expect(await env.DB.prepare('SELECT count(*) AS count FROM reviews').first()).toEqual({ count: reviews });
});

const window30 = Array.from({ length: 30 }, (_, i) => dates.addCalendarDays('2026-10-07', i + 1));
const fresh = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `p${i}`, nextReviewDate: null }));
it.each<{ name: string; problems: { id: string; nextReviewDate: string | null }[]; random: (count: number) => number; days: Record<string, string> }>([
	{ name: 'one problem gets the first free day', problems: fresh(1), random: () => 0, days: { p0: '2026-10-08' } },
	{ name: 'the last free day is day 30', problems: fresh(1), random: count => count - 1, days: { p0: '2026-11-06' } },
	{ name: '30 problems get 30 distinct days', problems: fresh(30), random: () => 0, days: Object.fromEntries(window30.map((day, i) => [`p${i}`, day])) },
	{ name: '31 problems use one day twice', problems: fresh(31), random: () => 0, days: Object.fromEntries([...window30, '2026-10-08'].map((day, i) => [`p${i}`, day])) },
	{ name: 'a date in the window stays and its day is used', problems: [{ id: 'kept', nextReviewDate: '2026-10-08' }, { id: 'new', nextReviewDate: null }], random: () => 0, days: { new: '2026-10-09' } },
	{ name: 'day 30 stays', problems: [{ id: 'kept', nextReviewDate: '2026-11-06' }], random: () => 0, days: {} },
	{ name: 'a past date gets a new day', problems: [{ id: 'past', nextReviewDate: '2026-10-01' }], random: () => 0, days: { past: '2026-10-08' } },
	{ name: 'today gets a new day', problems: [{ id: 'today', nextReviewDate: '2026-10-07' }], random: () => 0, days: { today: '2026-10-08' } },
	{ name: 'a date after day 30 gets a new day', problems: [{ id: 'late', nextReviewDate: '2026-11-07' }], random: count => count - 1, days: { late: '2026-11-06' } },
])('$name', ({ problems, random, days }) => { expect(spreadDays('2026-10-07', problems, random)).toEqual(days); });

it.each([
	{ name: 'student spreads a completed task', role: 'student', state: 'completed', archived: false, today: '2026-10-07', expected: 200, body: { count: 1, from: '2026-10-08', to: '2026-10-08' }, date: '2026-10-08', progressVersion: 2 },
	{ name: 'parent spreads a completed task', role: 'parent', state: 'completed', archived: false, today: '2026-10-07', expected: 200, body: { count: 1, from: '2026-10-08', to: '2026-10-08' }, date: '2026-10-08', progressVersion: 2 },
	{ name: 'archived problem is skipped', role: 'student', state: 'completed', archived: true, today: '2026-10-07', expected: 200, body: { count: 0, from: null, to: null }, date: '2026-10-07', progressVersion: 1 },
	{ name: 'no completed tasks', role: 'student', state: 'assigned', archived: false, today: '2026-10-07', expected: 200, body: { count: 0, from: null, to: null }, date: '2026-10-07', progressVersion: 1 },
	{ name: 'impossible today', role: 'student', state: 'completed', archived: false, today: '2026-02-30', expected: 400, body: { error: { code: 'invalid_input' } }, date: '2026-10-07', progressVersion: 1 },
])('$name', async ({ role, state, archived, today, expected, body, date, progressVersion }) => {
	vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => array);
	await env.DB.batch([env.DB.prepare('UPDATE homework_tasks SET state=?').bind(state), env.DB.prepare('UPDATE problems SET archived_at=? WHERE id=?').bind(archived ? 'now' : null, first)]);
	const response = await request('/reviews/distribute', 'POST', { today }, role === 'student' ? cookie : await login('parent'));
	expect(response.status).toBe(expected);
	expect(await response.json()).toMatchObject(body);
	expect(await env.DB.prepare('SELECT next_review_date,progress_version FROM problems WHERE id=?').bind(first).first()).toEqual({ next_review_date: date, progress_version: progressVersion });
});

// The window is [today + 15, today + 45]. The random value 30 gives the last day.
it.each([
	{ name: 'student gets the first day of the window', role: 'student', random: 0, today: '2026-10-07', status: 200, body: { nextReviewDate: '2026-10-22' }, after: { understanding: 'needs_practice', next_review_date: '2026-10-22', progress_version: 2 } },
	{ name: 'parent gets the last day of the window', role: 'parent', random: 30, today: '2026-10-07', status: 200, body: { nextReviewDate: '2026-11-21' }, after: { understanding: 'needs_practice', next_review_date: '2026-11-21', progress_version: 2 } },
	{ name: 'practice over a year boundary', role: 'student', random: 30, today: '2026-12-20', status: 200, body: { nextReviewDate: '2027-02-03' }, after: { understanding: 'needs_practice', next_review_date: '2027-02-03', progress_version: 2 } },
	{ name: 'impossible today', role: 'student', random: 0, today: '2026-02-30', status: 400, body: { error: { code: 'invalid_input' } }, after: { understanding: 'independent', next_review_date: '2026-10-07', progress_version: 1 } },
])('$name', async ({ role, random, today, status, body, after }) => {
	const account = role === 'student' ? cookie : await login('parent');
	vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { (array as Uint32Array)[0] = random; return array; });
	const response = await request(`/problems/${first}/practice`, 'POST', { today }, account);
	expect(response.status).toBe(status);
	expect(await response.json()).toMatchObject(body);
	expect(await env.DB.prepare('SELECT understanding,next_review_date,progress_version FROM problems WHERE id=?').bind(first).first()).toEqual(after);
});

it.each([
	{ name: 'due problem with a completed task opens a pick', state: 'completed', fromHomework: true },
	{ name: 'due problem with an active task opens the review', state: 'assigned', fromHomework: false },
	{ name: 'due problem with a cancelled task opens the review', state: 'cancelled', fromHomework: false },
])('$name', async ({ state, fromHomework }) => {
	await env.DB.prepare('UPDATE homework_tasks SET state=?').bind(state).run();
	const { dueReviews } = await (await request('/dashboard?today=2026-10-07', 'GET', undefined, cookie)).json() as Dashboard;
	expect(Object.fromEntries(dueReviews.map(problem => [problem.slug, problem.fromHomework]))).toEqual({ one: fromHomework, two: false, three: false });
});
