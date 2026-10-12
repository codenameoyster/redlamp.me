import type { Env } from '../index';
import type { OwnTest, ProblemTests } from '../../shared/leetcode';
import { HttpError, methods, object, readJson, text, uuid } from './http';
import { getProblem } from './problems';
import { sets, taskSlug, tasksOf } from './sets';

export async function handleTests(request: Request, env: Env): Promise<Response | null> {
	const match = /^\/leetcode\/api\/problems\/([^/]+)\/tests(?:\/([^/]+))?$/.exec(new URL(request.url).pathname);
	if (!match) return null;
	methods(request, match[2] ? ['DELETE'] : ['GET', 'POST']);
	const problem = await getProblem(env, uuid(match[1]));
	if (match[2]) {
		const result = await env.DB.prepare('DELETE FROM problem_tests WHERE id=? AND problem_id=?').bind(uuid(match[2]), problem.id).run();
		if (!result.meta.changes) throw new HttpError(404, 'not_found', 'Такого теста нет.');
		return new Response(null, { status: 204 });
	}
	if (request.method === 'POST') {
		// 10,000 characters of each field with escaped line breaks fit in 64 KB of JSON.
		const data = object(await readJson(request, 65_536), ['input', 'expected']);
		const value: OwnTest = { id: crypto.randomUUID(), input: text(data.input, 10_000, true), expected: text(data.expected, 10_000, true), createdAt: new Date().toISOString() };
		const result = await env.DB.prepare('INSERT INTO problem_tests (id,problem_id,input,expected,created_at) SELECT ?1,?2,?3,?4,?5 WHERE (SELECT count(*) FROM problem_tests WHERE problem_id=?2)<20').bind(value.id, problem.id, value.input, value.expected, value.createdAt).run();
		if (!result.meta.changes) throw new HttpError(409, 'too_many_tests', 'У задачи уже 20 своих тестов. Удалите лишний тест.');
		return Response.json(value, { status: 201 });
	}
	const task = sets.flatMap(tasksOf).find(item => taskSlug(item) === problem.slug);
	const { cases = [], ...spec } = task?.tests ?? (problem.slug.startsWith('cf-') ? { mode: 'stdio' as const } : {});
	const own = (await env.DB.prepare('SELECT id,input,expected,created_at AS createdAt FROM problem_tests WHERE problem_id=? ORDER BY created_at,id').bind(problem.id).all<OwnTest>()).results;
	return Response.json({ spec: 'mode' in spec ? spec : null, source: task ? 'set' : 'none', standard: cases, own } satisfies ProblemTests);
}
