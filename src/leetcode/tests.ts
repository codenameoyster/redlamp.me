import type { Env } from '../index';
import type { Expected, OwnTest, ProblemTests, SessionUser, TaskTests, TestRun } from '../../shared/leetcode';
import { requireRole } from './auth';
import { latestRuns } from './attempts';
import { calendarDate, HttpError, integer, methods, object, readJson, text, uuid } from './http';
import { getProblem, question } from './problems';
import { parsePy, reprPy } from '../../shared/answers';
import { referenceOf, sets, taskSlug, tasksOf, type Reference } from './sets';
import { htmlText } from './tutor';

const words: Record<string, string> = { true: 'True', false: 'False', null: 'None', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>', '&amp;': '&', '&nbsp;': ' ' };
// JSON values of LeetCode become Python literals: the strings stay, true, false and null change.
const python = (value: string) => value.replace(/"(?:[^"\\]|\\.)*"|\b(?:true|false|null)\b/g, token => words[token] ?? token);

const stdin = 'def ans():\n    N = int(input())\n    a = list(map(int, input().split()))\n    # Посчитайте ответ и верните его.\n    return 0\n\nt = int(input())\na = [ans() for _ in range(t)]\nfor res in a:\n    print(res)\n';

// One request gives the examples and the Python 3 starter code.
// ponytail: the examples compare in exact order, so a correct answer in another order fails. Add an order rule when a student finds such a problem.
async function lookup(titleSlug: string): Promise<{ tests: TaskTests | null; skeleton?: string } | null> {
	const value = await question<{ metaData: string; exampleTestcaseList: string[]; content: string | null; codeSnippets: { langSlug: string; code: string }[] | null }>(titleSlug, 'metaData exampleTestcaseList content codeSnippets { langSlug code }');
	if (!value) return null;
	const skeleton = value.codeSnippets?.find(item => item.langSlug === 'python3')?.code;
	const meta = JSON.parse(value.metaData) as { name?: string; manual?: boolean; params: { type: string }[]; return: { type: string }; output?: { paramindex: number } };
	// The harness gives plain Python values, so a design problem (no name), an interactive problem (manual) or a class type such as TreeNode gets no runner.
	if (!meta.name || meta.manual || [...meta.params, meta.return].some(item => /[A-Z]/.test(item.type))) return { tests: null, skeleton };
	const statement = (value.content ?? '').replace(/<[^>]*>/g, '').replace(/&(?:quot|#39|lt|gt|amp|nbsp);/g, entity => words[entity]);
	const outputs = [...statement.matchAll(/^\s*Output:\s*(.+)$/gm)].map(match => python(match[1].trim()));
	return { skeleton, tests: { mode: 'call', method: meta.name, ...(meta.output?.paramindex === 0 && { check: 'arg0' as const }), cases: value.exampleTestcaseList.map((input, index, list) => ({ input: python(`[${input.split('\n').join(',')}]`), expected: outputs.length === list.length ? outputs[index] : null })) } };
}

// The harness parses the answer in the 2-second time limit of the run. An answer of more than 100,000 characters can make a correct solution fail.
const sized = (value: string): Expected => value.length > 100_000 ? { error: 'size' } : { value };

// A reference error other than the constraints error comes from an input of a wrong shape or type.
export function expectedOf(reference: Reference, input: string): Expected {
	try {
		if (reference.mode === 'stdio') return sized(reference.solve(input));
		const args = parsePy(input);
		return Array.isArray(args) && args.length === reference.solve.length ? sized(reprPy(reference.solve(...args))) : { error: 'input' };
	} catch (error) {
		return { error: error instanceof RangeError && error.message === 'constraints' ? 'constraints' : 'input' };
	}
}

export async function handleTests(request: Request, env: Env): Promise<Response | null> {
	const match = /^\/leetcode\/api\/problems\/([^/]+)\/tests(?:\/([^/]+))?$/.exec(new URL(request.url).pathname);
	if (!match) return null;
	const expected = match[2] === 'expected';
	methods(request, expected ? ['POST'] : match[2] ? ['DELETE'] : ['GET', 'POST']);
	const problem = await getProblem(env, uuid(match[1]));
	if (expected) {
		// 20 inputs of 10,000 characters at two bytes each fit in 400 KB of JSON.
		const { inputs } = object(await readJson(request, 409_600), ['inputs']);
		if (!Array.isArray(inputs) || inputs.length > 20) throw new HttpError(400, 'invalid_input', 'Проверьте поля запроса.');
		const reference = referenceOf(problem.slug);
		// The inputs can be the hidden inputs of an open judge seed. A slug can move to another problem, so the answers make the seeds of all problems stale.
		await env.DB.prepare('DELETE FROM judge_runs').run();
		return Response.json({ expected: inputs.map(input => { text(input, 10_000, true); return reference ? expectedOf(reference, input) : null; }) });
	}
	if (match[2]) {
		const result = await env.DB.prepare('DELETE FROM problem_tests WHERE id=? AND problem_id=?').bind(uuid(match[2]), problem.id).run();
		if (!result.meta.changes) throw new HttpError(404, 'not_found', 'Такого теста нет.');
		return new Response(null, { status: 204 });
	}
	if (request.method === 'POST') {
		const value: OwnTest = { id: crypto.randomUUID(), input: text(object(await readJson(request), ['input']).input, 10_000, true), createdAt: new Date().toISOString() };
		const result = await env.DB.prepare('INSERT INTO problem_tests (id,problem_id,input,created_at) SELECT ?1,?2,?3,?4 WHERE (SELECT count(*) FROM problem_tests WHERE problem_id=?2)<20').bind(value.id, problem.id, value.input, value.createdAt).run();
		if (!result.meta.changes) throw new HttpError(409, 'too_many_tests', 'У задачи уже 20 своих тестов. Удалите лишний тест.');
		return Response.json(value, { status: 201 });
	}
	const task = sets.flatMap(tasksOf).find(item => taskSlug(item) === problem.slug)?.tests, codeforces = problem.slug.startsWith('cf-');
	const found = codeforces ? null : await lookup(problem.slug).catch(() => null), leetcode = task ? null : found?.tests;
	const { cases = [], ...spec } = task ?? leetcode ?? (codeforces ? { mode: 'stdio' as const } : {});
	const own = (await env.DB.prepare('SELECT id,input,created_at AS createdAt FROM problem_tests WHERE problem_id=? ORDER BY created_at,id').bind(problem.id).all<OwnTest>()).results;
	const skeleton = codeforces ? stdin : found?.skeleton ?? ('method' in spec ? 'class Solution:\n    pass' : '');
	return Response.json({ spec: 'mode' in spec ? spec : null, source: task ? 'set' : leetcode ? 'leetcode' : 'none', standard: cases, own, skeleton } satisfies ProblemTests);
}

export async function handleStatement(request: Request, env: Env): Promise<Response | null> {
	const match = /^\/leetcode\/api\/problems\/([^/]+)\/statement$/.exec(new URL(request.url).pathname);
	if (!match) return null;
	methods(request, ['GET']);
	const problem = await getProblem(env, uuid(match[1])), html = sets.flatMap(tasksOf).find(task => taskSlug(task) === problem.slug)?.statement ?? null;
	const content = html !== null || problem.slug.startsWith('cf-') ? null : await question<{ content: string | null }>(problem.slug, 'content').then(value => value?.content, () => null);
	return Response.json({ html, text: content ? htmlText(content) : null });
}

export async function handleRuns(request: Request, env: Env, user: SessionUser): Promise<Response | null> {
	const url = new URL(request.url), match = /^\/leetcode\/api\/problems\/([^/]+)\/runs$/.exec(url.pathname);
	if (!match) return null;
	methods(request, ['GET', 'POST']);
	const problemId = uuid(match[1]);
	if (request.method === 'GET') return Response.json((await env.DB.prepare(latestRuns('?', '?')).bind(problemId, uuid(url.searchParams.get('attemptId'))).all<TestRun>()).results);
	requireRole(user, 'student');
	const data = object(await readJson(request), ['attemptId', 'approachId', 'codeHash', 'passed', 'total', 'runOn']);
	const total = integer(data.total, 0, 100), value: TestRun = { approachId: uuid(data.approachId), passed: integer(data.passed, 0, total), total, codeHash: text(data.codeHash, 64), createdAt: new Date().toISOString() };
	if (!/^[a-f0-9]{64}$/.test(value.codeHash)) throw new HttpError(400, 'invalid_input', 'Проверьте поля запроса.');
	const result = await env.DB.prepare('INSERT INTO test_runs (id,problem_id,attempt_id,approach_id,code_hash,passed,total,run_on,created_at) SELECT ?,problem_id,id,?,?,?,?,?,? FROM attempts WHERE id=? AND problem_id=?')
		.bind(crypto.randomUUID(), value.approachId, value.codeHash, value.passed, total, calendarDate(text(data.runOn, 10, true)), value.createdAt, uuid(data.attemptId), problemId).run();
	if (!result.meta.changes) throw new HttpError(404, 'not_found', 'Такой попытки нет.');
	return Response.json(value, { status: 201 });
}
