import { env } from 'cloudflare:workers';
import { beforeEach, expect, it } from 'vitest';
import { login, request } from './client';
import type { Dashboard, HomeworkDetails, HomeworkSummary, HomeworkTask, Page, Role, TaskDetails } from '../shared/leetcode';

let student: string, parent: string, problemId: string, attemptId: string, homeworkId: string, taskId: string, submissionId: string;
const insertProblem = env.DB.prepare("INSERT INTO problems (id,slug,title,difficulty,topics,summary,search_text,created_at,updated_at) VALUES (?,?,?,'medium','[]','','','now','now')");
const insertBundle = env.DB.prepare("INSERT INTO homework (id,title,instructions,due_date,created_at,updated_at) VALUES (?,?,'Explain the invariant',?,?,?)");
const insertTask = env.DB.prepare("INSERT INTO homework_tasks (id,homework_id,problem_id,state,created_at,updated_at) VALUES (?,?,?,?,?,'now')");
const insertFeedback = env.DB.prepare("INSERT INTO feedback (id,problem_id,author,kind,body,created_at) VALUES (?,?,?,?,'Note',?)");
const insertRead = env.DB.prepare('INSERT INTO discussion_reads (role,problem_id,read_at) VALUES (?,?,?)');
beforeEach(async () => {
	student = await login(); parent = await login('parent');
	const problem = await (await request('/problems', 'POST', { url: 'https://leetcode.com/problems/two-sum/', number: 1, title: 'Two Sum', difficulty: 'easy', topics: [], summary: '' }, student)).json() as { id: string };
	problemId = problem.id;
	const attempt = await (await request(`/problems/${problemId}/attempts`, 'POST', {}, student)).json() as { id: string };
	attemptId = attempt.id; homeworkId = crypto.randomUUID(); taskId = crypto.randomUUID(); submissionId = crypto.randomUUID();
	await env.DB.prepare("UPDATE attempts SET document=json_set(document,'$.notes','Explain the counting invariant.') WHERE id=?").bind(attemptId).run();
	await env.DB.batch([insertBundle.bind(homeworkId, 'Two Sum practice', '2026-10-10', '2026-10-04', '2026-10-04'), insertTask.bind(taskId, homeworkId, problemId, 'assigned', '2026-10-04')]);
});

it.each([
	{ name: 'parent creates homework', role: 'parent', body: { title: ' Week 41: backtracking ', instructions: 'Explain each choice.', dueDate: '2026-10-12' }, expected: 201, stored: 2, fields: { title: 'Week 41: backtracking', instructions: 'Explain each choice.', dueDate: '2026-10-12', version: 1 } },
	{ name: 'title at 200 characters', role: 'parent', body: { title: 'x'.repeat(200), instructions: '', dueDate: null }, expected: 201, stored: 2, fields: { title: 'x'.repeat(200), dueDate: null } },
	{ name: 'title over 200 characters', role: 'parent', body: { title: 'x'.repeat(201), instructions: '', dueDate: null }, expected: 400, stored: 1, fields: { error: { code: 'invalid_input' } } },
	{ name: 'blank title', role: 'parent', body: { title: '  ', instructions: '', dueDate: null }, expected: 400, stored: 1, fields: { error: { code: 'invalid_input' } } },
	{ name: 'impossible due date', role: 'parent', body: { title: 'Week 41', instructions: '', dueDate: '2026-02-30' }, expected: 400, stored: 1, fields: { error: { code: 'invalid_input' } } },
	{ name: 'student cannot create homework', role: 'student', body: { title: 'Week 41', instructions: '', dueDate: null }, expected: 403, stored: 1, fields: { error: { code: 'forbidden' } } },
])('$name', async ({ role, body, expected, stored, fields }) => {
	const response = await request('/homework', 'POST', body, role === 'parent' ? parent : student);
	expect(response.status).toBe(expected);
	expect(await response.json()).toMatchObject(fields);
	expect(await env.DB.prepare('SELECT count(*) AS count FROM homework').first()).toEqual({ count: stored });
});

it.each([
	{ name: 'parent edits homework', role: 'parent', stored: 1, expected: 200, row: { title: 'Week 41', instructions: 'Compare two approaches.', due_date: null, version: 2 } },
	{ name: 'stale homework edit', role: 'parent', stored: 2, expected: 409, row: { title: 'Two Sum practice', instructions: 'Explain the invariant', due_date: '2026-10-10', version: 2 } },
	{ name: 'student cannot edit homework', role: 'student', stored: 1, expected: 403, row: { title: 'Two Sum practice', instructions: 'Explain the invariant', due_date: '2026-10-10', version: 1 } },
])('$name', async ({ role, stored, expected, row }) => {
	await env.DB.prepare('UPDATE homework SET version=?').bind(stored).run();
	const response = await request(`/homework/${homeworkId}`, 'PATCH', { version: 1, title: 'Week 41', instructions: 'Compare two approaches.', dueDate: null }, role === 'parent' ? parent : student);
	expect(response.status).toBe(expected);
	expect(await env.DB.prepare('SELECT title,instructions,due_date,version FROM homework').first()).toEqual(row);
});

async function bundles() {
	const [two, three] = [crypto.randomUUID(), crypto.randomUUID()], [arrays, backtracking, graphs] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
	await env.DB.batch([
		insertProblem.bind(two, 'three-sum', '3Sum'), insertProblem.bind(three, 'subsets', 'Subsets'),
		insertBundle.bind(arrays, 'Week 40: arrays', null, '2026-10-01', '2026-10-01'), insertBundle.bind(backtracking, 'Week 41: backtracking', null, '2026-10-02', '2026-10-02'), insertBundle.bind(graphs, 'Week 42: graphs', null, '2026-10-03', '2026-10-03'),
		insertTask.bind(crypto.randomUUID(), arrays, problemId, 'completed', '2026-10-01'), insertTask.bind(crypto.randomUUID(), arrays, problemId, 'cancelled', '2026-10-01'),
		insertTask.bind(crypto.randomUUID(), backtracking, two, 'submitted', '2026-10-02'), insertTask.bind(crypto.randomUUID(), backtracking, three, 'changes_requested', '2026-10-02'), insertTask.bind(crypto.randomUUID(), backtracking, problemId, 'completed', '2026-10-02'),
	]);
}

it.each([
	{ name: 'submitted homework first, then newest', query: '', titles: ['Week 41: backtracking', 'Two Sum practice', 'Week 42: graphs', 'Week 40: arrays'] },
	{ name: 'active homework keeps a bundle without tasks', query: 'active=1', titles: ['Week 41: backtracking', 'Two Sum practice', 'Week 42: graphs'] },
	{ name: 'title search ignores ASCII case', query: 'q=WEEK%204', titles: ['Week 41: backtracking', 'Week 42: graphs', 'Week 40: arrays'] },
	{ name: 'title search with active homework', query: 'q=week&active=1', titles: ['Week 41: backtracking', 'Week 42: graphs'] },
	{ name: 'title search without a match', query: 'q=heap', titles: [] },
	{ name: 'second page', query: 'limit=2&offset=2', titles: ['Week 42: graphs', 'Week 40: arrays'] },
])('$name', async ({ query, titles }) => {
	await bundles();
	const response = await request(`/homework?${query}`, 'GET', undefined, student);
	expect(response.status).toBe(200);
	expect((await response.json() as { items: HomeworkSummary[] }).items.map(item => item.title)).toEqual(titles);
});

it('counts the tasks of each bundle without cancelled tasks', async () => {
	await bundles();
	const { items } = await (await request('/homework', 'GET', undefined, parent)).json() as { items: HomeworkSummary[] };
	expect(items.map(({ title, taskCount, completedCount, submittedCount, requestedCount }) => ({ title, taskCount, completedCount, submittedCount, requestedCount }))).toEqual([
		{ title: 'Week 41: backtracking', taskCount: 3, completedCount: 1, submittedCount: 1, requestedCount: 1 },
		{ title: 'Two Sum practice', taskCount: 1, completedCount: 0, submittedCount: 0, requestedCount: 0 },
		{ title: 'Week 42: graphs', taskCount: 0, completedCount: 0, submittedCount: 0, requestedCount: 0 },
		{ title: 'Week 40: arrays', taskCount: 1, completedCount: 1, submittedCount: 0, requestedCount: 0 },
	]);
});

it.each([
	{ name: 'parent adds a task', role: 'parent', problem: 'other', bundle: 'other', archived: false, expected: 201, error: null },
	{ name: 'task after the earlier task completes', role: 'parent', problem: 'first', bundle: 'other', completeFirst: true, archived: false, expected: 201, error: null },
	{ name: 'student cannot add a task', role: 'student', problem: 'other', bundle: 'other', archived: false, expected: 403, error: { code: 'forbidden' } },
	{ name: 'problem with an active task in another bundle', role: 'parent', problem: 'first', bundle: 'other', archived: false, expected: 409, error: { code: 'active_homework', message: 'This problem already has an active task. Complete or cancel that task first.' } },
	{ name: 'problem with an active task in the same bundle', role: 'parent', problem: 'first', bundle: 'first', archived: false, expected: 409, error: { code: 'active_homework' } },
	{ name: 'task for an archived problem', role: 'parent', problem: 'other', bundle: 'other', archived: true, expected: 409, error: { code: 'archived', message: 'Restore this problem before you assign homework.' } },
	{ name: 'task for an unknown problem', role: 'parent', problem: 'unknown', bundle: 'other', archived: false, expected: 404, error: { code: 'not_found' } },
	{ name: 'task in an unknown bundle', role: 'parent', problem: 'other', bundle: 'unknown', archived: false, expected: 404, error: { code: 'not_found' } },
])('$name', async ({ role, problem, bundle, completeFirst, archived, expected, error }) => {
	const other = crypto.randomUUID(), otherBundle = crypto.randomUUID();
	await env.DB.batch([insertProblem.bind(other, 'subsets', 'Subsets'), insertBundle.bind(otherBundle, 'Week 41: backtracking', '2026-10-12', '2026-10-05', '2026-10-05'), env.DB.prepare('UPDATE problems SET archived_at=? WHERE id=?').bind(archived ? 'now' : null, other)]);
	if (completeFirst) await env.DB.prepare("UPDATE homework_tasks SET state='completed'").run();
	const chosen = { first: problemId, other, unknown: crypto.randomUUID() }[problem], target = { first: homeworkId, other: otherBundle, unknown: crypto.randomUUID() }[bundle];
	const response = await request('/tasks', 'POST', { homeworkId: target, problemId: chosen }, role === 'parent' ? parent : student);
	expect(response.status).toBe(expected);
	expect(await response.json()).toMatchObject(error ? { error } : { homeworkId: otherBundle, homeworkTitle: 'Week 41: backtracking', instructions: 'Explain the invariant', dueDate: '2026-10-12', problemId: chosen, state: 'assigned', submissionId: null, version: 1 });
	expect(await env.DB.prepare('SELECT count(*) AS count FROM homework_tasks').first()).toEqual({ count: error ? 1 : 2 });
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
		await env.DB.prepare('INSERT INTO submissions VALUES (?,?,?,?,?)').bind(submissionId, taskId, attemptId, 1, 'now').run();
	}
	await env.DB.prepare('UPDATE homework_tasks SET state=?,current_submission_id=?').bind(from, from === 'submitted' ? submissionId : null).run();
	const review = ['changes_requested', 'completed'].includes(action);
	const body = review ? { version: 1, submissionId, decision: action, body: 'Explain the next step.' } : action === 'submit' ? { version: 1, attemptId, attemptVersion: 1 } : { version: 1 };
	const response = await request(`/tasks/${taskId}/${review ? 'review' : action}`, 'POST', body, role === 'parent' ? parent : student);
	expect(response.status).toBe(expected);
	expect(await env.DB.prepare('SELECT state FROM homework_tasks WHERE id=?').bind(taskId).first()).toEqual({ state: to });
});

it.each([
	{ name: 'stale task leaves the draft and history unchanged', taskVersion: 2, attemptVersion: 1 },
	{ name: 'stale attempt leaves the draft and history unchanged', taskVersion: 1, attemptVersion: 2 },
])('$name', async ({ taskVersion, attemptVersion }) => {
	await env.DB.prepare('UPDATE homework_tasks SET version=?').bind(taskVersion).run();
	await env.DB.prepare('UPDATE attempts SET version=?').bind(attemptVersion).run();
	expect((await request(`/tasks/${taskId}/submit`, 'POST', { version: 1, attemptId, attemptVersion: 1 }, student)).status).toBe(409);
	expect(await env.DB.prepare('SELECT state,version FROM attempts').first()).toEqual({ state: 'draft', version: attemptVersion });
	expect(await env.DB.prepare('SELECT count(*) AS count FROM submissions').first()).toEqual({ count: 0 });
	expect(await (await request(`/problems/${problemId}`, 'GET', undefined, student)).json()).toMatchObject({ understanding: 'needs_practice', progressVersion: 1 });
});

it.each([
	{ name: 'blank change request', current: true, decision: 'changes_requested', body: '  ', expected: 400 },
	{ name: 'review of another submission', current: false, decision: 'completed', body: '', expected: 409 },
])('$name', async ({ current, decision, body, expected }) => {
	const record = await (await request(`/tasks/${taskId}/submit`, 'POST', { version: 1, attemptId, attemptVersion: 1 }, student)).json() as { submissionId: string };
	expect((await request(`/tasks/${taskId}/review`, 'POST', { version: 2, submissionId: current ? record.submissionId : crypto.randomUUID(), decision, body }, parent)).status).toBe(expected);
	expect(await env.DB.prepare('SELECT state,version FROM homework_tasks').first()).toEqual({ state: 'submitted', version: 2 });
	expect(await env.DB.prepare('SELECT count(*) AS count FROM feedback').first()).toEqual({ count: 0 });
});

it('rejects a repeated submission', async () => {
	const submit = () => request(`/tasks/${taskId}/submit`, 'POST', { version: 1, attemptId, attemptVersion: 1 }, student);
	expect((await submit()).status).toBe(200);
	expect((await submit()).status).toBe(409);
});

it('rejects a repeated review decision', async () => {
	const record = await (await request(`/tasks/${taskId}/submit`, 'POST', { version: 1, attemptId, attemptVersion: 1 }, student)).json() as { submissionId: string };
	const review = () => request(`/tasks/${taskId}/review`, 'POST', { version: 2, submissionId: record.submissionId, decision: 'changes_requested', body: 'Add a proof.' }, parent);
	expect((await review()).status).toBe(200);
	expect((await review()).status).toBe(409);
	expect(await env.DB.prepare('SELECT count(*) AS count FROM feedback').first()).toEqual({ count: 1 });
});

it.each([
	{ name: 'submission of empty work', empty: true, unknownAttempt: false, expected: 400 },
	{ name: 'submission of an unknown attempt', empty: false, unknownAttempt: true, expected: 404 },
])('$name', async ({ empty, unknownAttempt, expected }) => {
	if (empty) await env.DB.prepare("UPDATE attempts SET document=json_set(document,'$.notes','')").run();
	expect((await request(`/tasks/${taskId}/submit`, 'POST', { version: 1, attemptId: unknownAttempt ? crypto.randomUUID() : attemptId, attemptVersion: 1 }, student)).status).toBe(expected);
});

it('returns the task with its bundle and submissions', async () => {
	const record = await (await request(`/tasks/${taskId}/submit`, 'POST', { version: 1, attemptId, attemptVersion: 1 }, student)).json() as { submissionId: string };
	const response = await request(`/tasks/${taskId}`, 'GET', undefined, parent);
	expect(response.status).toBe(200);
	expect(await response.json()).toMatchObject({
		homework: { id: homeworkId, title: 'Two Sum practice', instructions: 'Explain the invariant', dueDate: '2026-10-10', version: 1 },
		task: { id: taskId, homeworkId, homeworkTitle: 'Two Sum practice', instructions: 'Explain the invariant', dueDate: '2026-10-10', problemId, problemTitle: 'Two Sum', difficulty: 'easy', state: 'submitted', submissionId: record.submissionId, version: 2 },
		submissions: [{ id: record.submissionId, taskId, attemptId, taskVersion: 2 }],
	});
});

it('lists the bundle tasks in creation order', async () => {
	const other = crypto.randomUUID();
	await env.DB.batch([insertProblem.bind(other, 'subsets', 'Subsets'), insertTask.bind(crypto.randomUUID(), homeworkId, other, 'assigned', '2026-10-03')]);
	const response = await request(`/homework/${homeworkId}`, 'GET', undefined, student);
	expect(response.status).toBe(200);
	expect(await response.json()).toMatchObject({ homework: { id: homeworkId, title: 'Two Sum practice' }, tasks: [{ problemTitle: 'Subsets', homeworkId }, { id: taskId, problemTitle: 'Two Sum', homeworkId }] });
});

it.each([
	{ name: 'unknown task', path: () => `/tasks/${crypto.randomUUID()}` },
	{ name: 'unknown homework', path: () => `/homework/${crypto.randomUUID()}` },
])('$name', async ({ path }) => {
	const response = await request(path(), 'GET', undefined, student);
	expect(response.status).toBe(404);
	expect(await response.json()).toMatchObject({ error: { code: 'not_found' } });
});

it.each([
	{ name: 'parent reply after completion', role: 'parent', task: 'own', expected: 201, error: null },
	{ name: 'student reply after completion', role: 'student', task: 'own', expected: 201, error: null },
	{ name: 'reply with the task of another problem', role: 'student', task: 'other', expected: 400, error: { code: 'invalid_reference' } },
	{ name: 'reply with an unknown task', role: 'student', task: 'unknown', expected: 404, error: { code: 'not_found' } },
])('$name', async ({ role, task, expected, error }) => {
	const otherProblem = crypto.randomUUID(), otherTask = crypto.randomUUID();
	await env.DB.batch([env.DB.prepare("UPDATE homework_tasks SET state='completed'"), insertProblem.bind(otherProblem, 'subsets', 'Subsets'), insertTask.bind(otherTask, homeworkId, otherProblem, 'assigned', '2026-10-05')]);
	const chosen = { own: taskId, other: otherTask, unknown: crypto.randomUUID() }[task];
	const response = await request(`/problems/${problemId}/feedback`, 'POST', { taskId: chosen, body: 'Follow-up question.' }, role === 'parent' ? parent : student);
	expect(response.status).toBe(expected);
	expect(await response.json()).toMatchObject(error ? { error } : { author: role as Role, taskId, kind: 'reply' });
	expect(await env.DB.prepare('SELECT count(*) AS count FROM feedback').first()).toEqual({ count: error ? 0 : 1 });
});

it.each([
	{ name: 'message from the other role without a read marker', viewer: 'parent', author: 'student', kind: 'reply', readRole: null, readAt: null, unread: true },
	{ name: 'own message', viewer: 'student', author: 'student', kind: 'reply', readRole: null, readAt: null, unread: false },
	{ name: 'read after the message', viewer: 'parent', author: 'student', kind: 'reply', readRole: 'parent', readAt: '2026-10-05T10:00:00.000Z', unread: false },
	{ name: 'message after the read', viewer: 'parent', author: 'student', kind: 'reply', readRole: 'parent', readAt: '2026-10-05T09:00:00.000Z', unread: true },
	{ name: 'read by the other role only', viewer: 'parent', author: 'student', kind: 'reply', readRole: 'student', readAt: '2026-10-05T10:00:00.000Z', unread: true },
	{ name: 'requested changes for the student', viewer: 'student', author: 'parent', kind: 'changes_requested', readRole: null, readAt: null, unread: true },
	{ name: 'completed review for the student', viewer: 'student', author: 'parent', kind: 'completed', readRole: null, readAt: null, unread: true },
])('$name', async ({ viewer, author, kind, readRole, readAt, unread }) => {
	await insertFeedback.bind(crypto.randomUUID(), problemId, author, kind, '2026-10-05T10:00:00.000Z').run();
	if (readRole) await insertRead.bind(readRole, problemId, readAt).run();
	const get = async <T>(path: string) => await (await request(path, 'GET', undefined, viewer === 'parent' ? parent : student)).json() as T;
	const [tasks, task, bundle, summary, dashboard] = [await get<Page<HomeworkTask>>('/tasks'), await get<TaskDetails>(`/tasks/${taskId}`), await get<HomeworkDetails>(`/homework/${homeworkId}`), await get<Page<HomeworkSummary>>('/homework'), await get<Dashboard>('/dashboard?today=2026-10-07')];
	expect({ tasks: tasks.items[0].unread, task: task.task.unread, bundle: bundle.tasks[0].unread, summary: summary.items[0].unread, dashboard: dashboard.homework[0].unread }).toEqual({ tasks: unread, task: unread, bundle: unread, summary: unread, dashboard: unread });
});

it.each([
	{ name: 'first page marks the newest message read', viewer: 'parent', offset: 0, messages: ['2026-10-05T10:00:00.000Z', '2026-10-05T09:00:00.000Z'], earlier: null, reads: [{ role: 'parent', read_at: '2026-10-05T10:00:00.000Z' }], unread: false },
	{ name: 'first page moves an earlier read marker', viewer: 'parent', offset: 0, messages: ['2026-10-05T09:00:00.000Z', '2026-10-05T10:00:00.000Z'], earlier: '2026-10-05T09:00:00.000Z', reads: [{ role: 'parent', read_at: '2026-10-05T10:00:00.000Z' }], unread: false },
	{ name: 'offset 50 does not mark read', viewer: 'parent', offset: 50, messages: ['2026-10-05T10:00:00.000Z'], earlier: null, reads: [], unread: true },
	{ name: 'first page without messages records no read marker', viewer: 'parent', offset: 0, messages: [], earlier: null, reads: [], unread: false },
	{ name: 'student read keeps the parent read marker', viewer: 'student', offset: 0, messages: ['2026-10-05T10:00:00.000Z'], earlier: '2026-10-05T09:00:00.000Z', reads: [{ role: 'parent', read_at: '2026-10-05T09:00:00.000Z' }, { role: 'student', read_at: '2026-10-05T10:00:00.000Z' }], unread: true },
])('$name', async ({ viewer, offset, messages, earlier, reads, unread }) => {
	for (const at of messages) await insertFeedback.bind(crypto.randomUUID(), problemId, 'student', 'reply', at).run();
	if (earlier) await insertRead.bind('parent', problemId, earlier).run();
	expect((await request(`/problems/${problemId}/feedback?offset=${offset}`, 'GET', undefined, viewer === 'parent' ? parent : student)).status).toBe(200);
	expect((await env.DB.prepare('SELECT role,read_at FROM discussion_reads ORDER BY role').all()).results).toEqual(reads);
	expect((await (await request(`/tasks/${taskId}`, 'GET', undefined, parent)).json() as TaskDetails).task.unread).toBe(unread);
});

it('marks a bundle unread when one of its tasks is unread', async () => {
	await bundles();
	await env.DB.prepare("INSERT INTO feedback (id,problem_id,author,kind,body,created_at) SELECT ?,id,'student','reply','Question','2026-10-05T10:00:00.000Z' FROM problems WHERE slug='subsets'").bind(crypto.randomUUID()).run();
	const { items } = await (await request('/homework', 'GET', undefined, parent)).json() as Page<HomeworkSummary>;
	expect(items.map(({ title, unread }) => ({ title, unread }))).toEqual([
		{ title: 'Week 41: backtracking', unread: true },
		{ title: 'Two Sum practice', unread: false },
		{ title: 'Week 42: graphs', unread: false },
		{ title: 'Week 40: arrays', unread: false },
	]);
});
