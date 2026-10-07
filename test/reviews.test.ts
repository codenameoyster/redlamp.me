import { env } from 'cloudflare:workers';
import { beforeEach, expect, it } from 'vitest';
import * as dates from '../shared/dates';
import { login, request } from './client';

let cookie: string, first: string;
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
	await env.DB.prepare("INSERT INTO homework (id,problem_id,instructions,due_date,state,created_at,updated_at) VALUES (?,?,'','2026-10-07','assigned','now','now')").bind(crypto.randomUUID(), first).run();
});

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
	expect((await request(`/problems/${first}/reviews`, 'POST', value, cookie)).status).toBe(409);
	expect(await env.DB.prepare('SELECT count(*) AS count FROM reviews').first()).toEqual({ count: 1 });
	expect(await (await request('/dashboard?today=2026-10-07', 'GET', undefined, cookie)).json()).toMatchObject({ counts: { solved: 2, independent: 0 } });
	expect(await (await request(`/problems/${first}`, 'GET', undefined, cookie)).json()).toMatchObject({ solved: true, understanding: 'needs_practice', nextReviewDate: '2026-10-08' });
});

it.each([
	{ name: 'before due day', today: '2026-10-06', dueReviews: 0, overdueHomework: 0 },
	{ name: 'same-day revision and homework', today: '2026-10-07', dueReviews: 3, overdueHomework: 0 },
	{ name: 'homework overdue the next day', today: '2026-10-08', dueReviews: 3, overdueHomework: 1 },
])('$name', async ({ today, dueReviews, overdueHomework }) => {
	const response = await request(`/dashboard?today=${today}`, 'GET', undefined, cookie);
	expect(response.status).toBe(200);
	expect(await response.json()).toMatchObject({ counts: { dueReviews, overdueHomework } });
});

it.each([
	{ name: 'impossible day', today: '2026-02-30' },
	{ name: 'missing local date', today: '' },
	{ name: 'timestamp in place of date', today: '2026-10-07T00:00:00Z' },
])('$name', async ({ today }) => { expect((await request(`/dashboard?today=${today}`, 'GET', undefined, cookie)).status).toBe(400); });

it('clears reminders, checks versions, and denies parent progress writes', async () => {
	const path = `/problems/${first}/review-date`;
	expect((await request(path, 'PATCH', { version: 1, nextReviewDate: '2026-02-30' }, cookie)).status).toBe(400);
	expect((await request(path, 'PATCH', { version: 1, nextReviewDate: null }, await login('parent'))).status).toBe(403);
	expect((await request(path, 'PATCH', { version: 1, nextReviewDate: null }, cookie)).status).toBe(200);
	expect((await request(path, 'PATCH', { version: 1, nextReviewDate: '2026-10-09' }, cookie)).status).toBe(409);
	expect(await (await request(`/problems/${first}`, 'GET', undefined, cookie)).json()).toMatchObject({ nextReviewDate: null, understanding: 'independent' });
});

it('excludes archived problems and avoids counting repeated accepted attempts', async () => {
	await env.DB.prepare("INSERT INTO attempts (id,problem_id,state,document,search_text,acceptance,understanding,created_at,updated_at) VALUES (?,?,'saved','{}','','accepted','independent','now','now')").bind(crypto.randomUUID(), first).run();
	await env.DB.prepare("UPDATE problems SET archived_at='now' WHERE slug='three'").run();
	expect(await (await request('/dashboard?today=2026-10-07', 'GET', undefined, cookie)).json()).toMatchObject({ counts: { recorded: 2, solved: 2, independent: 1, dueReviews: 2 } });
});
