import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { login, request } from './client';
import type { JudgeOutput } from '../shared/leetcode';
import { judge, mulberry32 } from '../src/leetcode/judge';
import * as sets from '../src/leetcode/sets';

// The values come from the C code of the reference: https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
it.each([
	{ name: 'seed 0', seed: 0, values: [1144304738, 1416247, 958946056] },
	{ name: 'seed 1', seed: 1, values: [2693262067, 11749833, 2265367787] },
	{ name: 'largest seed', seed: 4294967295, values: [3850105811, 813802916, 3073704848] },
])('$name', ({ seed, values }) => {
	const random = mulberry32(seed);
	expect([random(), random(), random()]).toEqual(values.map(value => value / 2 ** 32));
});

// The reference doubles the number of the input.
const double: sets.Reference = { mode: 'stdio', solve: input => `${Number(input) * 2}\n` };
it.each([
	{ name: 'all outputs pass', inputs: ['1', '2', '3'], outputs: [{ value: '2' }, { value: '4' }, { value: '6' }], judgement: { verdict: 'accepted', failed: null } },
	{ name: 'first failed test gives the verdict', inputs: ['1', '2', '3'], outputs: [{ value: '2' }, { value: '5' }, { timeout: true }], judgement: { verdict: 'wrong', failed: { index: 1, input: '2', expected: '4\n', output: '5' } } },
	{ name: 'timeout', inputs: ['1', '2', '3'], outputs: [{ timeout: true }, { value: '5' }, { value: '6' }], judgement: { verdict: 'timeout', failed: { index: 0, input: '1', expected: '2\n', output: '' } } },
	{ name: 'runtime error', inputs: ['1', '2', '3'], outputs: [{ value: '2' }, { value: '4' }, { error: 'ZeroDivisionError: division by zero' }], judgement: { verdict: 'error', failed: { index: 2, input: '3', expected: '6\n', output: 'ZeroDivisionError: division by zero' } } },
	{ name: 'texts over 2,000 characters', inputs: [`1${' '.repeat(2500)}`], outputs: [{ value: '3'.repeat(2500) }], judgement: { verdict: 'wrong', failed: { index: 0, input: `1${' '.repeat(1999)}…`, expected: '2\n', output: `${'3'.repeat(2000)}…` } } },
	{ name: 'text of 2,000 characters', inputs: ['1'], outputs: [{ value: '3'.repeat(2000) }], judgement: { verdict: 'wrong', failed: { index: 0, input: '1', expected: '2\n', output: '3'.repeat(2000) } } },
])('$name', ({ inputs, outputs, judgement }) => {
	expect(judge(double, { mode: 'stdio' }, inputs, outputs as JudgeOutput[])).toEqual(judgement);
});

let student: string, problemId: string, attemptId: string;
const slug = 'two-sum-ii-input-array-is-sorted';
// A test generator for Two Sum II. The last input takes a number from random.
const generate = (random: () => number) => { const n = 1 + Math.floor(random() * 1000); return ['[[2, 7, 11, 15], 9]', '[[2, 3, 4], 6]', `[[0, ${n}], ${n}]`]; };
const insertProblem = env.DB.prepare("INSERT INTO problems (id,slug,title,difficulty,topics,summary,search_text,created_at,updated_at) VALUES (?,?,'Problem','medium','[]','','','now','now')");
beforeEach(async () => {
	vi.spyOn(sets, 'generatorOf').mockImplementation(value => value === slug ? generate : undefined);
	student = await login(); problemId = crypto.randomUUID();
	await insertProblem.bind(problemId, slug).run();
	attemptId = (await (await request(`/problems/${problemId}/attempts`, 'POST', {}, student)).json() as { id: string }).id;
	await env.DB.prepare("INSERT INTO judge_runs VALUES (?,1,'now')").bind(problemId).run();
});
afterEach(() => { vi.restoreAllMocks(); });

it.each([
	{ name: 'student gets the inputs of a new seed', role: 'student', judged: true, status: 200, code: null },
	{ name: 'parent cannot start the judge', role: 'parent', judged: true, status: 403, code: 'forbidden' },
	{ name: 'problem without a judge', role: 'student', judged: false, status: 404, code: 'no_judge' },
])('$name', async ({ role, judged, status, code }) => {
	const id = judged ? problemId : crypto.randomUUID();
	if (!judged) await insertProblem.bind(id, 'two-sum').run();
	const response = await request(`/problems/${id}/judge/start`, 'POST', undefined, role === 'parent' ? await login('parent') : student);
	expect(response.status).toBe(status);
	if (code) { expect(await response.json()).toMatchObject({ error: { code } }); return; }
	const { seed, inputs } = await response.json() as { seed: number; inputs: string[] };
	expect(inputs).toEqual(generate(mulberry32(seed)));
});

// With seed 1 the last input is [[0, 628], 628].
const answers = [{ value: '[1, 2]' }, { value: '[1, 3]' }, { value: '[1, 2]' }];
it.each([
	{ name: 'wrong answer', role: 'student', outputs: [answers[0], { value: '[2, 3]' }, answers[2]], status: 200, body: { verdict: 'wrong', failed: { index: 1, input: '[[2, 3, 4], 6]', expected: '[1, 3]', output: '[2, 3]' } } },
	{ name: 'wrong answer of the generated input', role: 'student', outputs: [answers[0], answers[1], { value: '[1, 628]' }], status: 200, body: { verdict: 'wrong', failed: { index: 2, input: '[[0, 628], 628]', expected: '[1, 2]', output: '[1, 628]' } } },
	{ name: 'output at 1,000,000 characters', role: 'student', outputs: [answers[0], answers[1], { value: '9'.repeat(1_000_000) }], status: 200, body: { verdict: 'wrong', failed: { index: 2, input: '[[0, 628], 628]', expected: '[1, 2]', output: `${'9'.repeat(2000)}…` } } },
	{ name: 'output over 1,000,000 characters', role: 'student', outputs: [answers[0], answers[1], { value: '9'.repeat(1_000_001) }], status: 400, body: { error: { code: 'invalid_input' } } },
	{ name: 'fewer outputs than inputs', role: 'student', outputs: answers.slice(1), status: 400, body: { error: { code: 'invalid_input' } } },
	{ name: 'output with a value and an error', role: 'student', outputs: [{ ...answers[0], error: 'ValueError' }, answers[1], answers[2]], status: 400, body: { error: { code: 'invalid_input' } } },
	{ name: 'timeout that is false', role: 'student', outputs: [{ timeout: false }, answers[1], answers[2]], status: 400, body: { error: { code: 'invalid_input' } } },
	{ name: 'parent cannot judge', role: 'parent', outputs: answers, status: 403, body: { error: { code: 'forbidden' } } },
])('$name', async ({ role, outputs, status, body }) => {
	const response = await request(`/problems/${problemId}/judge`, 'POST', { seed: 1, attemptId, outputs }, role === 'parent' ? await login('parent') : student);
	expect(response.status).toBe(status);
	expect(await response.json()).toMatchObject(body);
	expect(await env.DB.prepare('SELECT state,acceptance FROM attempts').first()).toEqual({ state: 'draft', acceptance: 'not_submitted' });
});

it.each([
	{ name: 'seed of a started check', start: true, replay: false, answered: null, status: 200, code: null },
	{ name: 'seed that the server did not give', start: false, replay: false, answered: null, status: 409, code: 'stale_seed' },
	{ name: 'seed used for a second verdict', start: true, replay: true, answered: null, status: 409, code: 'stale_seed' },
	{ name: 'seed whose inputs the reference answered as own tests', start: true, replay: false, answered: 'same', status: 409, code: 'stale_seed' },
	{ name: 'seed whose inputs another problem answered as own tests', start: true, replay: false, answered: 'other', status: 409, code: 'stale_seed' },
])('$name', async ({ start, replay, answered, status, code }) => {
	const seed = start ? (await (await request(`/problems/${problemId}/judge/start`, 'POST', undefined, student)).json() as { seed: number }).seed : 2, outputs = generate(mulberry32(seed)).map(() => ({ value: '[9, 9]' }));
	if (replay) await request(`/problems/${problemId}/judge`, 'POST', { seed, attemptId, outputs }, student);
	if (answered) {
		const id = answered === 'same' ? problemId : crypto.randomUUID();
		if (answered === 'other') await insertProblem.bind(id, 'two-sum').run();
		expect((await request(`/problems/${id}/tests/expected`, 'POST', { inputs: generate(mulberry32(seed)) }, student)).status).toBe(200);
	}
	const response = await request(`/problems/${problemId}/judge`, 'POST', { seed, attemptId, outputs }, student);
	expect(response.status).toBe(status);
	expect(await response.json()).toMatchObject(code ? { error: { code } } : { verdict: 'wrong', failed: { index: 0 } });
});

const insertMessage = env.DB.prepare("INSERT INTO tutor_messages (id,context_kind,context_ref,author,body,created_at) VALUES (?,?,?,?,'Hint','now')");
const insertBundle = env.DB.prepare("INSERT INTO homework (id,title,instructions,created_at,updated_at) VALUES (?,'Week 41','','now','now')");
const insertTask = env.DB.prepare("INSERT INTO homework_tasks (id,homework_id,problem_id,state,created_at,updated_at) VALUES (?,?,?,?,'now','now')");
it.each([
	{ name: 'accepted without tutor messages', message: null, task: null, understanding: 'independent', after: null },
	{ name: 'accepted after a student message to the tutor', message: { kind: 'problem', author: 'student' }, task: null, understanding: 'with_help', after: null },
	{ name: 'accepted after only tutor answers', message: { kind: 'problem', author: 'assistant' }, task: null, understanding: 'independent', after: null },
	{ name: 'accepted after a message in the set thread', message: { kind: 'set', author: 'student' }, task: null, understanding: 'independent', after: null },
	{ name: 'accepted task in progress', message: null, task: 'in_progress', understanding: 'independent', after: { state: 'completed', version: 2, taskVersion: 2, author: 'student', kind: 'completed', body: 'Принято проверкой.' } },
	{ name: 'accepted assigned task', message: null, task: 'assigned', understanding: 'independent', after: { state: 'completed', version: 2, taskVersion: 2, author: 'student', kind: 'completed', body: 'Принято проверкой.' } },
	{ name: 'accepted submitted task', message: null, task: 'submitted', understanding: 'independent', after: { state: 'completed', version: 2, taskVersion: 2, author: 'student', kind: 'completed', body: 'Принято проверкой.' } },
	{ name: 'accepted task with requested changes', message: null, task: 'changes_requested', understanding: 'independent', after: { state: 'completed', version: 2, taskVersion: 2, author: 'student', kind: 'completed', body: 'Принято проверкой.' } },
	{ name: 'completed task stays', message: null, task: 'completed', understanding: 'independent', after: { state: 'completed', version: 1, taskVersion: null, author: null, kind: null, body: null } },
	{ name: 'cancelled task stays', message: null, task: 'cancelled', understanding: 'independent', after: { state: 'cancelled', version: 1, taskVersion: null, author: null, kind: null, body: null } },
])('$name', async ({ message, task, understanding, after }) => {
	const homeworkId = crypto.randomUUID();
	if (message) await insertMessage.bind(crypto.randomUUID(), message.kind, message.kind === 'set' ? 'two-pointers' : problemId, message.author).run();
	if (task) await env.DB.batch([insertBundle.bind(homeworkId), insertTask.bind(crypto.randomUUID(), homeworkId, problemId, task)]);
	const response = await request(`/problems/${problemId}/judge`, 'POST', { seed: 1, attemptId, outputs: answers }, student);
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ verdict: 'accepted', failed: null });
	expect(await env.DB.prepare('SELECT state,acceptance,understanding,version FROM attempts').first()).toEqual({ state: 'saved', acceptance: 'accepted', understanding, version: 2 });
	expect(await env.DB.prepare('SELECT understanding,progress_version FROM problems').first()).toEqual({ understanding, progress_version: 2 });
	expect(await env.DB.prepare('SELECT t.state,t.version,s.task_version AS taskVersion,f.author,f.kind,f.body FROM homework_tasks t LEFT JOIN submissions s ON s.id=t.current_submission_id AND s.attempt_id=? LEFT JOIN feedback f ON f.submission_id=s.id AND f.task_id=t.id').bind(attemptId).first()).toEqual(after);
});

it.each([
	{ name: 'accepted outputs of a saved attempt', saved: true, known: true, status: 409, code: 'conflict' },
	{ name: 'accepted outputs of an unknown attempt', saved: false, known: false, status: 404, code: 'not_found' },
])('$name', async ({ saved, known, status, code }) => {
	const homeworkId = crypto.randomUUID();
	await env.DB.batch([insertBundle.bind(homeworkId), insertTask.bind(crypto.randomUUID(), homeworkId, problemId, 'in_progress')]);
	if (saved) await env.DB.prepare("UPDATE attempts SET state='saved'").run();
	const response = await request(`/problems/${problemId}/judge`, 'POST', { seed: 1, attemptId: known ? attemptId : crypto.randomUUID(), outputs: answers }, student);
	expect(response.status).toBe(status);
	expect(await response.json()).toMatchObject({ error: { code } });
	expect(await env.DB.prepare('SELECT acceptance,understanding FROM attempts').first()).toEqual({ acceptance: 'not_submitted', understanding: 'needs_practice' });
	expect(await env.DB.prepare('SELECT t.state,(SELECT count(*) FROM submissions) AS submissions,(SELECT count(*) FROM feedback) AS feedback FROM homework_tasks t').first()).toEqual({ state: 'in_progress', submissions: 0, feedback: 0 });
});

const withNotes = env.DB.prepare("UPDATE attempts SET document=json_set(document,'$.notes',?)");
it.each([
	{ name: 'solved without tutor messages', message: false, task: null, understanding: 'independent', after: null },
	{ name: 'solved after a student message to the tutor', message: true, task: null, understanding: 'with_help', after: null },
	{ name: 'solved assigned task', message: false, task: 'assigned', understanding: 'independent', after: { state: 'submitted', version: 2, taskVersion: 2, feedback: 0 } },
	{ name: 'solved task in progress', message: false, task: 'in_progress', understanding: 'independent', after: { state: 'submitted', version: 2, taskVersion: 2, feedback: 0 } },
	{ name: 'solved task with requested changes', message: false, task: 'changes_requested', understanding: 'independent', after: { state: 'submitted', version: 2, taskVersion: 2, feedback: 0 } },
	{ name: 'submitted task stays', message: false, task: 'submitted', understanding: 'independent', after: { state: 'submitted', version: 1, taskVersion: null, feedback: 0 } },
	{ name: 'completed task stays', message: false, task: 'completed', understanding: 'independent', after: { state: 'completed', version: 1, taskVersion: null, feedback: 0 } },
	{ name: 'cancelled task stays', message: false, task: 'cancelled', understanding: 'independent', after: { state: 'cancelled', version: 1, taskVersion: null, feedback: 0 } },
])('$name', async ({ message, task, understanding, after }) => {
	vi.mocked(sets.generatorOf).mockReturnValue(undefined);
	const homeworkId = crypto.randomUUID();
	await withNotes.bind('Two pointers.').run();
	if (message) await insertMessage.bind(crypto.randomUUID(), 'problem', problemId, 'student').run();
	if (task) await env.DB.batch([insertBundle.bind(homeworkId), insertTask.bind(crypto.randomUUID(), homeworkId, problemId, task)]);
	const response = await request(`/problems/${problemId}/solved`, 'POST', { attemptId }, student);
	expect(response.status).toBe(200);
	expect(await response.json()).toMatchObject({ id: attemptId, state: 'saved', acceptance: 'accepted', understanding, version: 2 });
	expect(await env.DB.prepare('SELECT understanding,progress_version FROM problems').first()).toEqual({ understanding, progress_version: 2 });
	expect(await env.DB.prepare('SELECT t.state,t.version,s.task_version AS taskVersion,(SELECT count(*) FROM feedback) AS feedback FROM homework_tasks t LEFT JOIN submissions s ON s.id=t.current_submission_id AND s.attempt_id=?').bind(attemptId).first()).toEqual(after);
});

it.each([
	{ name: 'parent cannot mark a problem solved', role: 'parent', judged: false, notes: 'Two pointers.', attempt: 'draft', status: 403, code: 'forbidden' },
	{ name: 'problem with a judge', role: 'student', judged: true, notes: 'Two pointers.', attempt: 'draft', status: 409, code: 'judged' },
	{ name: 'empty work', role: 'student', judged: false, notes: ' ', attempt: 'draft', status: 400, code: 'empty_attempt' },
	{ name: 'solved attempt again', role: 'student', judged: false, notes: 'Two pointers.', attempt: 'saved', status: 409, code: 'conflict' },
	{ name: 'unknown attempt', role: 'student', judged: false, notes: 'Two pointers.', attempt: 'unknown', status: 404, code: 'not_found' },
])('$name', async ({ role, judged, notes, attempt, status, code }) => {
	if (!judged) vi.mocked(sets.generatorOf).mockReturnValue(undefined);
	const homeworkId = crypto.randomUUID();
	await env.DB.batch([withNotes.bind(notes), insertBundle.bind(homeworkId), insertTask.bind(crypto.randomUUID(), homeworkId, problemId, 'in_progress')]);
	if (attempt === 'saved') await env.DB.prepare("UPDATE attempts SET state='saved'").run();
	const response = await request(`/problems/${problemId}/solved`, 'POST', { attemptId: attempt === 'unknown' ? crypto.randomUUID() : attemptId }, role === 'parent' ? await login('parent') : student);
	expect(response.status).toBe(status);
	expect(await response.json()).toMatchObject({ error: { code } });
	expect(await env.DB.prepare('SELECT acceptance,understanding FROM attempts').first()).toEqual({ acceptance: 'not_submitted', understanding: 'needs_practice' });
	expect(await env.DB.prepare('SELECT t.state,(SELECT count(*) FROM submissions) AS submissions FROM homework_tasks t').first()).toEqual({ state: 'in_progress', submissions: 0 });
});
