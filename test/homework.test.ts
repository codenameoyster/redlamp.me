import { env } from 'cloudflare:workers';
import { beforeEach, expect, it } from 'vitest';
import { login, request } from './client';
import type { Role } from '../shared/leetcode';

let student: string, parent: string, problemId: string, attemptId: string, homeworkId: string, submissionId: string;
beforeEach(async () => {
	student = await login(); parent = await login('parent');
	const problem = await (await request('/problems', 'POST', { url: 'https://leetcode.com/problems/two-sum/', number: 1, title: 'Two Sum', difficulty: 'easy', topics: [], summary: '' }, student)).json() as { id: string };
	problemId = problem.id;
	const attempt = await (await request(`/problems/${problemId}/attempts`, 'POST', {}, student)).json() as { id: string };
	attemptId = attempt.id; homeworkId = crypto.randomUUID(); submissionId = crypto.randomUUID();
	await env.DB.prepare("UPDATE attempts SET document=json_set(document,'$.notes','Explain the counting invariant.') WHERE id=?").bind(attemptId).run();
	await env.DB.prepare("INSERT INTO homework (id,problem_id,instructions,state,created_at,updated_at) VALUES (?,?,'Explain the invariant','assigned','now','now')").bind(homeworkId, problemId).run();
});

it.each([
	{ name: 'student starts assignment', role: 'student', from: 'assigned', action: 'start', expected: 200, to: 'in_progress' },
	{ name: 'student submits new homework', role: 'student', from: 'assigned', action: 'submit', expected: 200, to: 'submitted' },
	{ name: 'student submits progress', role: 'student', from: 'in_progress', action: 'submit', expected: 200, to: 'submitted' },
	{ name: 'student resubmits changes', role: 'student', from: 'changes_requested', action: 'submit', expected: 200, to: 'submitted' },
	{ name: 'parent requests changes', role: 'parent', from: 'submitted', action: 'changes_requested', expected: 200, to: 'changes_requested' },
	{ name: 'parent completes review', role: 'parent', from: 'submitted', action: 'completed', expected: 200, to: 'completed' },
	{ name: 'student cannot complete', role: 'student', from: 'submitted', action: 'completed', expected: 403, to: 'submitted' },
	{ name: 'parent cannot submit', role: 'parent', from: 'assigned', action: 'submit', expected: 403, to: 'assigned' },
	{ name: 'cancel assigned', role: 'parent', from: 'assigned', action: 'cancel', expected: 200, to: 'cancelled' },
	{ name: 'cancel progress', role: 'parent', from: 'in_progress', action: 'cancel', expected: 200, to: 'cancelled' },
	{ name: 'cancel submitted', role: 'parent', from: 'submitted', action: 'cancel', expected: 200, to: 'cancelled' },
	{ name: 'cancel requested changes', role: 'parent', from: 'changes_requested', action: 'cancel', expected: 200, to: 'cancelled' },
	{ name: 'completed homework stays complete', role: 'parent', from: 'completed', action: 'cancel', expected: 409, to: 'completed' },
])('$name', async ({ role, from, action, expected, to }) => {
	if (from === 'submitted') {
		await env.DB.prepare("UPDATE attempts SET state='saved'").run();
		await env.DB.prepare('INSERT INTO submissions VALUES (?,?,?,?,?)').bind(submissionId, homeworkId, attemptId, 1, 'now').run();
	}
	await env.DB.prepare('UPDATE homework SET state=?,current_submission_id=?').bind(from, from === 'submitted' ? submissionId : null).run();
	const review = ['changes_requested', 'completed'].includes(action);
	const body = review ? { version: 1, submissionId, decision: action, body: 'Explain the next step.' } : action === 'submit' ? { version: 1, attemptId, attemptVersion: 1 } : { version: 1 };
	const response = await request(`/homework/${homeworkId}/${review ? 'review' : action}`, 'POST', body, role === 'parent' ? parent : student);
	expect(response.status).toBe(expected);
	expect(await env.DB.prepare('SELECT state FROM homework WHERE id=?').bind(homeworkId).first()).toEqual({ state: to });
});

it.each([
	{ name: 'stale homework leaves the draft and history unchanged', homeworkVersion: 2, attemptVersion: 1 },
	{ name: 'stale attempt leaves the draft and history unchanged', homeworkVersion: 1, attemptVersion: 2 },
])('$name', async ({ homeworkVersion, attemptVersion }) => {
	await env.DB.prepare('UPDATE homework SET version=?').bind(homeworkVersion).run();
	await env.DB.prepare('UPDATE attempts SET version=?').bind(attemptVersion).run();
	expect((await request(`/homework/${homeworkId}/submit`, 'POST', { version: 1, attemptId, attemptVersion: 1 }, student)).status).toBe(409);
	expect(await env.DB.prepare('SELECT state,version FROM attempts').first()).toEqual({ state: 'draft', version: attemptVersion });
	expect(await env.DB.prepare('SELECT count(*) AS count FROM submissions').first()).toEqual({ count: 0 });
	expect(await (await request(`/problems/${problemId}`, 'GET', undefined, student)).json()).toMatchObject({ understanding: 'needs_practice', progressVersion: 1 });
});

it.each([
	{ name: 'blank change request', current: true, decision: 'changes_requested', body: '  ', expected: 400 },
	{ name: 'review of another submission', current: false, decision: 'completed', body: '', expected: 409 },
])('$name', async ({ current, decision, body, expected }) => {
	const record = await (await request(`/homework/${homeworkId}/submit`, 'POST', { version: 1, attemptId, attemptVersion: 1 }, student)).json() as { submissionId: string };
	expect((await request(`/homework/${homeworkId}/review`, 'POST', { version: 2, submissionId: current ? record.submissionId : crypto.randomUUID(), decision, body }, parent)).status).toBe(expected);
	expect(await env.DB.prepare('SELECT state,version FROM homework').first()).toEqual({ state: 'submitted', version: 2 });
	expect(await env.DB.prepare('SELECT count(*) AS count FROM feedback').first()).toEqual({ count: 0 });
});

it('rejects a repeated submission', async () => {
	const submit = () => request(`/homework/${homeworkId}/submit`, 'POST', { version: 1, attemptId, attemptVersion: 1 }, student);
	expect((await submit()).status).toBe(200);
	expect((await submit()).status).toBe(409);
});

it('rejects a repeated review decision', async () => {
	const record = await (await request(`/homework/${homeworkId}/submit`, 'POST', { version: 1, attemptId, attemptVersion: 1 }, student)).json() as { submissionId: string };
	const review = () => request(`/homework/${homeworkId}/review`, 'POST', { version: 2, submissionId: record.submissionId, decision: 'changes_requested', body: 'Add a proof.' }, parent);
	expect((await review()).status).toBe(200);
	expect((await review()).status).toBe(409);
	expect(await env.DB.prepare('SELECT count(*) AS count FROM feedback').first()).toEqual({ count: 1 });
});

it.each([
	{ name: 'submission of empty work', empty: true, unknownAttempt: false, expected: 400 },
	{ name: 'submission of an unknown attempt', empty: false, unknownAttempt: true, expected: 404 },
])('$name', async ({ empty, unknownAttempt, expected }) => {
	if (empty) await env.DB.prepare("UPDATE attempts SET document=json_set(document,'$.notes','')").run();
	expect((await request(`/homework/${homeworkId}/submit`, 'POST', { version: 1, attemptId: unknownAttempt ? crypto.randomUUID() : attemptId, attemptVersion: 1 }, student)).status).toBe(expected);
});

it.each([
	{ name: 'student cannot assign', role: 'student', known: true, archived: false, expected: 403, error: { code: 'forbidden' } },
	{ name: 'one active assignment', role: 'parent', known: true, archived: false, expected: 409, error: { code: 'active_homework', message: 'This problem already has active homework. Complete or cancel it first.' } },
	{ name: 'assignment for an archived problem', role: 'parent', known: true, archived: true, expected: 409, error: { code: 'archived', message: 'Restore this problem before you assign homework.' } },
	{ name: 'assignment for an unknown problem', role: 'parent', known: false, archived: false, expected: 404, error: { code: 'not_found' } },
])('$name', async ({ role, known, archived, expected, error }) => {
	if (archived) await env.DB.batch([env.DB.prepare("UPDATE homework SET state='completed'"), env.DB.prepare("UPDATE problems SET archived_at='now'")]);
	const response = await request('/homework', 'POST', { problemId: known ? problemId : crypto.randomUUID(), instructions: '', dueDate: null }, role === 'parent' ? parent : student);
	expect(response.status).toBe(expected);
	expect(await response.json()).toMatchObject({ error });
});

it.each([{ name: 'parent reply after completion', role: 'parent' }, { name: 'student reply after completion', role: 'student' }])('$name', async ({ role }) => {
	await env.DB.prepare("UPDATE homework SET state='completed'").run();
	const response = await request(`/problems/${problemId}/feedback`, 'POST', { homeworkId, body: 'Follow-up question.' }, role === 'parent' ? parent : student);
	expect(response.status).toBe(201);
	expect(await response.json()).toMatchObject({ author: role as Role, homeworkId, kind: 'reply' });
});
