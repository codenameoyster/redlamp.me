import { env } from 'cloudflare:workers';
import { beforeEach, expect, it } from 'vitest';
import { login, request } from './client';
import { addCalendarDays } from '../shared/dates';
import type { Dashboard, HomeworkBoard, HomeworkDetails, HomeworkSummary, HomeworkTask, Page, TaskDetails } from '../shared/leetcode';

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

// The server takes today from its own UTC clock.
const today = new Date().toISOString().slice(0, 10), tomorrow = addCalendarDays(today, 1);
it.each([
	{ name: 'student moves the due date by one day', role: 'student', due: today, used: false, version: 1, expected: 200, code: null, dueAfter: tomorrow, postponedTo: tomorrow },
	{ name: 'second use of Сила Бомжа', role: 'student', due: today, used: true, version: 1, expected: 409, code: 'postponed', dueAfter: today, postponedTo: '2026-10-10' },
	{ name: 'parent cannot postpone', role: 'parent', due: today, used: false, version: 1, expected: 403, code: 'forbidden', dueAfter: today, postponedTo: null },
	{ name: 'postpone after the due date', role: 'student', due: addCalendarDays(today, -1), used: false, version: 1, expected: 400, code: 'invalid_input', dueAfter: addCalendarDays(today, -1), postponedTo: null },
	{ name: 'postpone without a due date', role: 'student', due: null, used: false, version: 1, expected: 400, code: 'invalid_input', dueAfter: null, postponedTo: null },
	{ name: 'stale postpone', role: 'student', due: today, used: false, version: 2, expected: 409, code: 'conflict', dueAfter: today, postponedTo: null },
])('$name', async ({ role, due, used, version, expected, code, dueAfter, postponedTo }) => {
	await env.DB.prepare('UPDATE homework SET due_date=?').bind(due).run();
	if (used) await env.DB.prepare("INSERT INTO postponements VALUES (?,'2026-10-09','2026-10-10','now')").bind(homeworkId).run();
	const response = await request(`/homework/${homeworkId}/postpone`, 'POST', { version }, role === 'parent' ? parent : student);
	expect(response.status).toBe(expected);
	expect(await response.json()).toMatchObject(code ? { error: { code } } : { dueDate: dueAfter, postponedTo, version: 2 });
	expect(await (await request(`/homework/${homeworkId}`, 'GET', undefined, parent)).json()).toMatchObject({ homework: { dueDate: dueAfter, postponedTo }, tasks: [{ dueDate: dueAfter, postponedTo }] });
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
	{ name: 'problem with an active task in another bundle', role: 'parent', problem: 'first', bundle: 'other', archived: false, expected: 409, error: { code: 'active_homework', message: 'У этой задачи уже есть активное задание. Сначала завершите или отмените его.' } },
	{ name: 'problem with an active task in the same bundle', role: 'parent', problem: 'first', bundle: 'first', archived: false, expected: 409, error: { code: 'active_homework' } },
	{ name: 'task for an archived problem', role: 'parent', problem: 'other', bundle: 'other', archived: true, expected: 409, error: { code: 'archived', message: 'Верните задачу из архива, прежде чем назначать домашнюю работу.' } },
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
	{ name: 'parent requests changes', role: 'parent', from: 'submitted', action: 'changes_requested', expected: 200, to: 'changes_requested' },
	{ name: 'parent completes review', role: 'parent', from: 'submitted', action: 'completed', expected: 200, to: 'completed' },
	{ name: 'student cannot complete', role: 'student', from: 'submitted', action: 'completed', expected: 403, to: 'submitted' },
	{ name: 'cancel assigned', role: 'parent', from: 'assigned', action: 'cancel', expected: 200, to: 'cancelled' },
	{ name: 'cancel progress', role: 'parent', from: 'in_progress', action: 'cancel', expected: 200, to: 'cancelled' },
	{ name: 'cancel submitted', role: 'parent', from: 'submitted', action: 'cancel', expected: 200, to: 'cancelled' },
	{ name: 'cancel requested changes', role: 'parent', from: 'changes_requested', action: 'cancel', expected: 200, to: 'cancelled' },
	{ name: 'completed homework stays complete', role: 'parent', from: 'completed', action: 'cancel', expected: 409, to: 'completed' },
	{ name: 'parent returns a completed task', role: 'parent', from: 'completed', action: 'changes_requested', expected: 200, to: 'changes_requested' },
	{ name: 'parent cannot complete a completed task again', role: 'parent', from: 'completed', action: 'completed', expected: 409, to: 'completed' },
])('$name', async ({ role, from, action, expected, to }) => {
	const reviewed = ['submitted', 'completed'].includes(from);
	if (reviewed) {
		await env.DB.prepare("UPDATE attempts SET state='saved'").run();
		await env.DB.prepare('INSERT INTO submissions VALUES (?,?,?,?,?)').bind(submissionId, taskId, attemptId, 1, 'now').run();
	}
	await env.DB.prepare('UPDATE homework_tasks SET state=?,current_submission_id=?').bind(from, reviewed ? submissionId : null).run();
	const review = ['changes_requested', 'completed'].includes(action);
	const body = review ? { version: 1, submissionId, decision: action, body: 'Explain the next step.' } : { version: 1 };
	const response = await request(`/tasks/${taskId}/${review ? 'review' : action}`, 'POST', body, role === 'parent' ? parent : student);
	expect(response.status).toBe(expected);
	expect(await env.DB.prepare('SELECT state FROM homework_tasks WHERE id=?').bind(taskId).first()).toEqual({ state: to });
});

// The student marks the draft solved, so the assigned task gets a submission of the draft.
async function solve(): Promise<string> {
	expect((await request(`/problems/${problemId}/solved`, 'POST', { attemptId }, student)).status).toBe(200);
	return (await env.DB.prepare('SELECT id FROM submissions').first<{ id: string }>())!.id;
}

it.each([
	{ name: 'blank change request', current: true, decision: 'changes_requested', body: '  ', expected: 400 },
	{ name: 'review of another submission', current: false, decision: 'completed', body: '', expected: 409 },
])('$name', async ({ current, decision, body, expected }) => {
	const submission = await solve();
	expect((await request(`/tasks/${taskId}/review`, 'POST', { version: 2, submissionId: current ? submission : crypto.randomUUID(), decision, body }, parent)).status).toBe(expected);
	expect(await env.DB.prepare('SELECT state,version FROM homework_tasks').first()).toEqual({ state: 'submitted', version: 2 });
	expect(await env.DB.prepare('SELECT count(*) AS count FROM feedback').first()).toEqual({ count: 0 });
});

it('rejects a repeated review decision', async () => {
	const submission = await solve();
	const review = () => request(`/tasks/${taskId}/review`, 'POST', { version: 2, submissionId: submission, decision: 'changes_requested', body: 'Add a proof.' }, parent);
	expect((await review()).status).toBe(200);
	expect((await review()).status).toBe(409);
	expect(await env.DB.prepare('SELECT count(*) AS count FROM feedback').first()).toEqual({ count: 1 });
});

it('returns the task with its bundle and submissions', async () => {
	const submission = await solve();
	const response = await request(`/tasks/${taskId}`, 'GET', undefined, parent);
	expect(response.status).toBe(200);
	expect(await response.json()).toMatchObject({
		homework: { id: homeworkId, title: 'Two Sum practice', instructions: 'Explain the invariant', dueDate: '2026-10-10', version: 1 },
		task: { id: taskId, homeworkId, homeworkTitle: 'Two Sum practice', instructions: 'Explain the invariant', dueDate: '2026-10-10', problemId, problemTitle: 'Two Sum', difficulty: 'easy', state: 'submitted', submissionId: submission, version: 2 },
		submissions: [{ id: submission, taskId, attemptId, taskVersion: 2 }],
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

it('rejects a discussion reply', async () => {
	const response = await request(`/problems/${problemId}/feedback`, 'POST', { taskId, body: 'Follow-up question.' }, student);
	expect(response.status).toBe(405);
	expect(response.headers.get('Allow')).toBe('GET');
	expect(await env.DB.prepare('SELECT count(*) AS count FROM feedback').first()).toEqual({ count: 0 });
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

it.each([
	{ name: 'assigned task is in the future section', role: 'student', state: 'assigned', section: 'future' },
	{ name: 'started task is in progress', role: 'student', state: 'in_progress', section: 'progress' },
	{ name: 'submitted task is in progress', role: 'student', state: 'submitted', section: 'progress' },
	{ name: 'task with requested changes is in progress', role: 'student', state: 'changes_requested', section: 'progress' },
	{ name: 'completed task is accepted', role: 'student', state: 'completed', section: 'accepted' },
	{ name: 'parent sees the same board', role: 'parent', state: 'completed', section: 'accepted' },
	{ name: 'cancelled task is not on the board', role: 'student', state: 'cancelled', section: null },
])('$name', async ({ role, state, section }) => {
	await env.DB.prepare('UPDATE homework_tasks SET state=?').bind(state).run();
	const response = await request('/tasks?view=board', 'GET', undefined, role === 'parent' ? parent : student);
	expect(response.status).toBe(200);
	const task = { id: taskId, homeworkId, homeworkTitle: 'Two Sum practice', dueDate: '2026-10-10', problemId, problemTitle: 'Two Sum', state, unread: false };
	expect(await response.json()).toEqual({ progress: [], future: [], accepted: [], ...section && { [section]: [expect.objectContaining(task)] } });
});

it.each([
	{ name: 'progress by due date with no date last', section: 'progress', tasks: [{ title: 'No date', state: 'in_progress', due: null, at: 'now' }, { title: 'Later', state: 'submitted', due: '2026-10-12', at: 'now' }, { title: 'Sooner', state: 'changes_requested', due: '2026-10-11', at: 'now' }], titles: ['Sooner', 'Later', 'No date'] },
	{ name: 'future by due date with no date last', section: 'future', tasks: [{ title: 'No date', state: 'assigned', due: null, at: 'now' }, { title: 'Later', state: 'assigned', due: '2026-10-12', at: 'now' }, { title: 'Sooner', state: 'assigned', due: '2026-10-11', at: 'now' }], titles: ['Sooner', 'Later', 'No date'] },
	{ name: 'accepted by completion time with the newest first', section: 'accepted', tasks: [{ title: 'First', state: 'completed', due: null, at: '2026-10-05T10:00:00.000Z' }, { title: 'Last', state: 'completed', due: null, at: '2026-10-07T10:00:00.000Z' }, { title: 'Middle', state: 'completed', due: '2026-10-01', at: '2026-10-06T10:00:00.000Z' }], titles: ['Last', 'Middle', 'First'] },
])('$name', async ({ section, tasks, titles }) => {
	const insertDone = env.DB.prepare("INSERT INTO homework_tasks (id,homework_id,problem_id,state,created_at,updated_at) VALUES (?,?,?,?,'now',?)");
	await env.DB.batch([env.DB.prepare("UPDATE homework_tasks SET state='cancelled'"), ...tasks.flatMap(task => {
		const [id, bundle] = [crypto.randomUUID(), crypto.randomUUID()];
		return [insertProblem.bind(id, task.title, task.title), insertBundle.bind(bundle, task.title, task.due, 'now', 'now'), insertDone.bind(crypto.randomUUID(), bundle, id, task.state, task.at)];
	})]);
	const board = await (await request('/tasks?view=board', 'GET', undefined, student)).json() as HomeworkBoard;
	expect(board[section as keyof HomeworkBoard].map(task => task.problemTitle)).toEqual(titles);
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
