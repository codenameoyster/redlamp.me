import { env } from 'cloudflare:workers';
import { beforeEach, expect, it } from 'vitest';
import { login, request } from './client';
import type { HomeworkDetails, HomeworkSummary, HomeworkTask, Page, Problem } from '../shared/leetcode';

let parent: string, student: string, homeworkId: string;
beforeEach(async () => {
	parent = await login('parent'); student = await login();
	const response = await request('/homework', 'POST', { title: 'Chapter practice', instructions: '', dueDate: null }, parent);
	homeworkId = (await response.json() as { id: string }).id;
});

it.each([
	{ name: 'student cannot assign content', role: 'student', body: { kind: 'chapter', setSlug: 'complexity', chapter: 1 }, status: 403 },
	{ name: 'unknown set', role: 'parent', body: { kind: 'chapter', setSlug: 'missing', chapter: 1 }, status: 404 },
	{ name: 'missing chapter', role: 'parent', body: { kind: 'chapter', setSlug: 'complexity', chapter: 2 }, status: 404 },
	{ name: 'chapter zero', role: 'parent', body: { kind: 'chapter', setSlug: 'complexity', chapter: 0 }, status: 400 },
	{ name: 'fractional chapter', role: 'parent', body: { kind: 'chapter', setSlug: 'complexity', chapter: 1.5 }, status: 400 },
	{ name: 'unknown target type', role: 'parent', body: { kind: 'problem', setSlug: 'complexity', chapter: 1 }, status: 400 },
])('$name', async ({ role, body, status }) => {
	expect((await request(`/homework/${homeworkId}/content`, 'POST', body, role === 'parent' ? parent : student)).status).toBe(status);
	expect((await (await request(`/homework/${homeworkId}`, 'GET', undefined, parent)).json() as HomeworkDetails).tasks).toEqual([]);
});

it.each([
	{ name: 'archived problem is reported', archived: true, solved: false, taskState: null, reason: 'Задача в архиве.' },
	{ name: 'solved problem is reported', archived: false, solved: true, taskState: null, reason: 'Задача уже выполнена.' },
	{ name: 'completed homework problem is reported', archived: false, solved: false, taskState: 'completed', reason: 'Задача уже выполнена.' },
	{ name: 'active problem stays in its homework', archived: false, solved: false, taskState: 'assigned', reason: 'У задачи уже есть активное задание.' },
])('$name', async ({ archived, solved, taskState, reason }) => {
	const problem = await (await request('/problems', 'POST', { url: 'https://leetcode.com/problems/valid-palindrome/', number: 125, title: 'My palindrome', difficulty: 'easy', topics: ['String'], summary: 'My notes' }, parent)).json() as Problem;
	if (archived) await request(`/problems/${problem.id}/archive`, 'POST', { version: 1 }, parent);
	if (solved) await env.DB.prepare("INSERT INTO attempts (id,problem_id,state,document,search_text,acceptance,understanding,created_at,updated_at) VALUES (?,?,'saved','{}','','accepted','independent','now','now')").bind(crypto.randomUUID(), problem.id).run();
	if (taskState) {
		const other = await (await request('/homework', 'POST', { title: 'Other homework', instructions: '' }, parent)).json() as { id: string };
		await env.DB.prepare('INSERT INTO homework_tasks (id,homework_id,problem_id,state,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(), other.id, problem.id, taskState, 'now', 'now').run();
	}
	const response = await request(`/homework/${homeworkId}/content`, 'POST', { kind: 'chapter', setSlug: 'two-pointers', chapter: 1 }, parent);
	expect(response.status).toBe(201);
	expect(await response.json()).toEqual({ added: 6, skipped: [{ title: 'Valid Palindrome', reason }] });
	const { tasks } = await (await request(`/homework/${homeworkId}`, 'GET', undefined, parent)).json() as HomeworkDetails;
	expect(tasks).toHaveLength(6);
	expect(tasks.some(task => task.problemId === problem.id)).toBe(false);
	expect(await (await request(`/problems/${problem.id}`, 'GET', undefined, parent)).json()).toMatchObject({ title: 'My palindrome', summary: 'My notes' });
});

it.each([
	{ name: 'student completes chapter reading', role: 'student', version: 1, kind: 'chapter', status: 200, state: 'completed' },
	{ name: 'stale reading completion is rejected', role: 'student', version: 2, kind: 'chapter', status: 409, state: 'assigned' },
	{ name: 'parent cannot complete student reading', role: 'parent', version: 1, kind: 'chapter', status: 403, state: 'assigned' },
	{ name: 'quiz requires a passing attempt', role: 'student', version: 1, kind: 'quiz', status: 409, state: 'assigned' },
])('$name', async ({ role, version, kind, status, state }) => {
	await request(`/homework/${homeworkId}/content`, 'POST', { kind: 'chapter', setSlug: 'complexity', chapter: 1 }, parent);
	const { items } = await (await request(`/tasks?kind=${kind}&setSlug=complexity&chapter=1`, 'GET', undefined, student)).json() as Page<HomeworkTask>;
	expect(items).toHaveLength(1);
	const response = await request(`/tasks/${items[0].id}/complete`, 'POST', { version }, role === 'parent' ? parent : student);
	expect(response.status).toBe(status);
	const { tasks } = await (await request(`/homework/${homeworkId}`, 'GET', undefined, parent)).json() as HomeworkDetails;
	expect(tasks.find(task => task.id === items[0].id)).toMatchObject({ state, completedAt: state === 'completed' ? expect.any(String) : null });
	const summary = await (await request('/homework', 'GET', undefined, parent)).json() as Page<HomeworkSummary>;
	expect(summary.items[0]).toMatchObject({ taskCount: 2, completedCount: state === 'completed' ? 1 : 0 });
});

it('includes assigned reading in homework materials without algorithm problems', async () => {
	await request(`/homework/${homeworkId}/content`, 'POST', { kind: 'chapter', setSlug: 'complexity', chapter: 1 }, parent);
	expect(await (await request(`/homework/${homeworkId}/sets`, 'GET', undefined, student)).json()).toMatchObject({ chapters: [{ set: 'complexity', number: 1 }] });
});

it('rolls back the chapter when a task insert fails', async () => {
	await env.DB.exec("CREATE TRIGGER fail_assignment BEFORE INSERT ON homework_tasks WHEN NEW.problem_id IN (SELECT id FROM problems WHERE slug='boats-to-save-people') BEGIN SELECT RAISE(ABORT, 'test storage failure'); END");
	expect((await request(`/homework/${homeworkId}/content`, 'POST', { kind: 'chapter', setSlug: 'two-pointers', chapter: 1 }, parent)).ok).toBe(false);
	expect((await (await request(`/homework/${homeworkId}`, 'GET', undefined, student)).json() as HomeworkDetails).tasks).toEqual([]);
	expect((await (await request('/problems', 'GET', undefined, student)).json() as Page<Problem>).items).toEqual([]);
});

it.each([
	{ name: 'chapter includes its reading, quiz, and five problems', kind: 'chapter', setSlug: 'two-pointers', count: 7, problems: ['Boats to Save People', 'Container With Most Water', 'Max Number of K-Sum Pairs', 'Two Sum II - Input Array Is Sorted', 'Valid Palindrome'] },
	{ name: 'chapter without problems includes reading and quiz', kind: 'chapter', setSlug: 'complexity', count: 2, problems: [] },
	{ name: 'standalone quiz includes no reading or problems', kind: 'quiz', setSlug: 'two-pointers', count: 1, problems: [] },
])('$name', async ({ kind, setSlug, count, problems }) => {
	const response = await request(`/homework/${homeworkId}/content`, 'POST', { kind, setSlug, chapter: 1 }, parent);
	expect(response.status).toBe(201);
	expect(await response.json()).toEqual({ added: count, skipped: [] });
	const { tasks } = await (await request(`/homework/${homeworkId}`, 'GET', undefined, student)).json() as HomeworkDetails;
	expect(tasks).toHaveLength(count);
	expect(tasks.filter(t => t.kind === 'problem').map(t => t.title).sort()).toEqual(problems);
	expect(tasks.find(t => t.kind === 'quiz')).toMatchObject({ href: `/leetcode/quiz/${setSlug}-1` });
	if (kind === 'chapter') expect(tasks.find(t => t.kind === 'chapter')).toMatchObject({ href: `/leetcode/sets/${setSlug}/1` });
	const again = await request(`/homework/${homeworkId}/content`, 'POST', { kind, setSlug, chapter: 1 }, parent);
	expect(await again.json()).toMatchObject({ added: 0 });
	expect((await (await request(`/homework/${homeworkId}`, 'GET', undefined, parent)).json() as HomeworkDetails).tasks).toHaveLength(count);
});
