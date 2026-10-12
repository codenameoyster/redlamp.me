import type { Env } from '../index';
import type { OwnTest, ProblemTests, TaskTests } from '../../shared/leetcode';
import { HttpError, methods, object, readJson, text, uuid } from './http';
import { getProblem, question } from './problems';
import { sets, taskSlug, tasksOf } from './sets';

const words: Record<string, string> = { true: 'True', false: 'False', null: 'None', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>', '&amp;': '&', '&nbsp;': ' ' };
// JSON values of LeetCode become Python literals: the strings stay, true, false and null change.
const python = (value: string) => value.replace(/"(?:[^"\\]|\\.)*"|\b(?:true|false|null)\b/g, token => words[token] ?? token);

// ponytail: the examples compare in exact order, so a correct answer in another order fails. Add an order rule when a student finds such a problem.
async function examples(titleSlug: string): Promise<TaskTests | null> {
	const value = await question<{ metaData: string; exampleTestcaseList: string[]; content: string | null }>(titleSlug, 'metaData exampleTestcaseList content');
	if (!value) return null;
	const meta = JSON.parse(value.metaData) as { name?: string; params: { type: string }[]; return: { type: string }; output?: { paramindex: number } };
	// The harness gives plain Python values, so a design problem (no name) or a class type such as TreeNode gets no runner.
	if (!meta.name || [...meta.params, meta.return].some(item => /[A-Z]/.test(item.type))) return null;
	const statement = (value.content ?? '').replace(/<[^>]*>/g, '').replace(/&(?:quot|#39|lt|gt|amp|nbsp);/g, entity => words[entity]);
	const outputs = [...statement.matchAll(/^\s*Output:\s*(.+)$/gm)].map(match => python(match[1].trim()));
	return { mode: 'call', method: meta.name, ...(meta.output?.paramindex === 0 && { check: 'arg0' as const }), cases: value.exampleTestcaseList.map((input, index, list) => ({ input: python(`[${input.split('\n').join(',')}]`), expected: outputs.length === list.length ? outputs[index] : null })) };
}

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
	const task = sets.flatMap(tasksOf).find(item => taskSlug(item) === problem.slug)?.tests, codeforces = problem.slug.startsWith('cf-');
	const leetcode = task || codeforces ? null : await examples(problem.slug).catch(() => null);
	const { cases = [], ...spec } = task ?? leetcode ?? (codeforces ? { mode: 'stdio' as const } : {});
	const own = (await env.DB.prepare('SELECT id,input,expected,created_at AS createdAt FROM problem_tests WHERE problem_id=? ORDER BY created_at,id').bind(problem.id).all<OwnTest>()).results;
	return Response.json({ spec: 'mode' in spec ? spec : null, source: task ? 'set' : leetcode ? 'leetcode' : 'none', standard: cases, own } satisfies ProblemTests);
}
