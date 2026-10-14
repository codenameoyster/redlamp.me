import type { Env } from '../index';
import { hasWork, type JudgeOutput, type Judgement, type SessionUser, type TestSpec } from '../../shared/leetcode';
import { requireRole } from './auth';
import { getAttempt, saveProgress } from './attempts';
import { changed, HttpError, integer, methods, object, readJson, uuid } from './http';
import { getProblem } from './problems';
import { parsePy, reprPy } from './pyliteral';
import { generatorOf, referenceOf, sets, taskSlug, tasksOf, type Reference } from './sets';

// Mulberry32, a seeded 32-bit PRNG: https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
export function mulberry32(seed: number): () => number {
	return () => {
		let z = seed = seed + 0x6D2B79F5 | 0;
		z = Math.imul(z ^ z >>> 15, z | 1);
		z ^= z + Math.imul(z ^ z >>> 7, z | 61);
		return ((z ^ z >>> 14) >>> 0) / 2 ** 32;
	};
}

// The stdout tokens, or the Python text of the value with the lists of a free order sorted. A sort by the Python text gives the same equality as the sort of the harness.
function canonical(spec: TestSpec, answer: string): string {
	if (spec.mode === 'stdio') return answer.split(/\s+/).filter(Boolean).join(' ');
	const value = parsePy(answer), order = spec.order ?? 'exact';
	return order === 'exact' ? reprPy(value) : JSON.stringify((value as unknown[]).map(item => order === 'any' ? reprPy(item) : JSON.stringify((item as unknown[]).map(reprPy).sort())).sort());
}
// An output that is not a Python literal, or not a list for a free order, is a wrong answer.
export function same(spec: TestSpec, expected: string, output: string): boolean {
	try { return canonical(spec, expected) === canonical(spec, output); } catch { return false; }
}

const cut = (value: string) => value.length > 2000 ? `${value.slice(0, 2000)}…` : value;
// The first failed test gives the verdict, so the reference answers only the tests up to it.
export function judge(reference: Reference, spec: TestSpec, inputs: string[], outputs: JudgeOutput[]): Judgement {
	for (const [index, input] of inputs.entries()) {
		const output = outputs[index], expected = reference.mode === 'stdio' ? reference.solve(input) : reprPy(reference.solve(...parsePy(input) as unknown[]));
		if ('value' in output && same(spec, expected, output.value)) continue;
		return { verdict: 'value' in output ? 'wrong' : 'error' in output ? 'error' : 'timeout', failed: { index, input: cut(input), expected: cut(expected), output: cut('value' in output ? output.value : 'error' in output ? output.error : '') } };
	}
	return { verdict: 'accepted', failed: null };
}

function outputOf(value: unknown): JudgeOutput {
	const item = object(value, ['value', 'error', 'timeout']), [key, extra] = Object.keys(item);
	if (extra || (key === 'timeout' ? item.timeout !== true : typeof item[key] !== 'string' || (item[key] as string).length > 1_000_000)) throw new HttpError(400, 'invalid_input', 'Проверьте поля запроса.');
	return item as JudgeOutput;
}

export async function handleJudge(request: Request, env: Env, user: SessionUser): Promise<Response | null> {
	const match = /^\/leetcode\/api\/problems\/([^/]+)\/(judge\/start|judge|solved)$/.exec(new URL(request.url).pathname);
	if (!match) return null;
	methods(request, ['POST']);
	requireRole(user, 'student');
	const problem = await getProblem(env, uuid(match[1])), generate = generatorOf(problem.slug), solved = match[2] === 'solved';
	let attemptId: string, result: Judgement = { verdict: 'accepted', failed: null };
	if (solved) {
		if (generate) throw new HttpError(409, 'judged', 'Эту задачу проверяют скрытые тесты. Нажмите «Отправить».');
		attemptId = uuid(object(await readJson(request), ['attemptId']).attemptId);
		const { document } = await getAttempt(env, problem.id, attemptId);
		if (!hasWork(document)) throw new HttpError(400, 'empty_attempt', 'Добавьте объяснение, заметки или код перед отправкой.');
	} else {
		if (!generate) throw new HttpError(404, 'no_judge', 'У этой задачи нет скрытых тестов.');
		if (match[2] === 'judge/start') {
			const seed = crypto.getRandomValues(new Uint32Array(1))[0];
			await env.DB.prepare('INSERT OR IGNORE INTO judge_runs VALUES (?,?,?)').bind(problem.id, seed, new Date().toISOString()).run();
			return Response.json({ seed, inputs: generate(mulberry32(seed)) });
		}
		// 16 outputs of 1,000,000 ASCII characters fit in 16 MiB.
		const data = object(await readJson(request, 16_777_216), ['seed', 'attemptId', 'outputs']), seed = integer(data.seed, 0, 2 ** 32 - 1), inputs = generate(mulberry32(seed));
		attemptId = uuid(data.attemptId);
		if (!Array.isArray(data.outputs) || data.outputs.length !== inputs.length) throw new HttpError(400, 'invalid_input', 'Проверьте поля запроса.');
		// A wrong verdict shows the answer of the failed test, so each seed gives one verdict.
		if (!await env.DB.prepare('DELETE FROM judge_runs WHERE problem_id=? AND seed=? RETURNING seed').bind(problem.id, seed).first()) throw new HttpError(409, 'stale_seed', 'Эта проверка устарела. Нажмите «Отправить» ещё раз.');
		result = judge(referenceOf(problem.slug)!, sets.flatMap(tasksOf).find(task => taskSlug(task) === problem.slug)!.tests!, inputs, data.outputs.map(outputOf));
		if (result.verdict !== 'accepted') return Response.json(result);
	}
	// The draft becomes the accepted attempt. The judge completes the active homework task of the problem. The solved route submits the task for the parent review. The later statements change rows only when the attempt was a draft.
	const now = new Date().toISOString(), submissionId = crypto.randomUUID();
	const results = await env.DB.batch([
		env.DB.prepare("UPDATE attempts SET state='saved',acceptance='accepted',understanding=CASE WHEN EXISTS(SELECT 1 FROM tutor_messages WHERE context_kind='problem' AND context_ref=?2 AND author='student') THEN 'with_help' ELSE 'independent' END,version=version+1,saved_at=?3,updated_at=?3 WHERE id=?1 AND problem_id=?2 AND state='draft'").bind(attemptId, problem.id, now),
		saveProgress(env, problem.id, attemptId, now),
		env.DB.prepare(`INSERT INTO submissions (id,task_id,attempt_id,task_version,created_at) SELECT ?,id,?,version+1,? FROM homework_tasks WHERE problem_id=? AND state IN ('assigned','in_progress','changes_requested'${solved ? '' : ",'submitted'"}) AND changes()=1`).bind(submissionId, attemptId, now, problem.id),
		...solved ? [] : [env.DB.prepare("INSERT INTO feedback (id,problem_id,task_id,submission_id,author,kind,body,created_at) SELECT ?,?,task_id,id,'student','completed','Принято проверкой.',? FROM submissions WHERE id=?").bind(crypto.randomUUID(), problem.id, now, submissionId)],
		env.DB.prepare('UPDATE homework_tasks SET state=?3,current_submission_id=?1,version=version+1,updated_at=?2 WHERE id=(SELECT task_id FROM submissions WHERE id=?1)').bind(submissionId, now, solved ? 'submitted' : 'completed'),
	]);
	if (!results[0].meta.changes) await getAttempt(env, problem.id, attemptId);
	changed(results[0]);
	return Response.json(solved ? await getAttempt(env, problem.id, attemptId) : result);
}
