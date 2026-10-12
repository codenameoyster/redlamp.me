import type { Env } from '../index';
import type { ProblemTests } from '../../shared/leetcode';
import { methods, uuid } from './http';
import { getProblem } from './problems';
import { sets, taskSlug, tasksOf } from './sets';

export async function handleTests(request: Request, env: Env): Promise<Response | null> {
	const match = /^\/leetcode\/api\/problems\/([^/]+)\/tests$/.exec(new URL(request.url).pathname);
	if (!match) return null;
	methods(request, ['GET']);
	const problem = await getProblem(env, uuid(match[1]));
	const task = sets.flatMap(tasksOf).find(item => taskSlug(item) === problem.slug);
	const { cases = [], ...spec } = task?.tests ?? (problem.slug.startsWith('cf-') ? { mode: 'stdio' as const } : {});
	return Response.json({ spec: 'mode' in spec ? spec : null, source: task ? 'set' : 'none', standard: cases, own: [] } satisfies ProblemTests);
}
