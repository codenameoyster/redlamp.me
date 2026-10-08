import type { Env } from '../../index';
import type { LearningSet, LearningSetDetails, LearningSetSummary, SessionUser, TaskState } from '../../../shared/leetcode';
import { requireRole } from '../auth';
import { getHomework } from '../homework';
import { changed, HttpError, integer, methods, object, readJson, uuid } from '../http';
import { LESSON_CSP } from '../lessons';
import { getProblem, solvedSQL } from '../problems';
import permutationsAndCombinations from './permutations-and-combinations/set';
import permutationsAndCombinationsLesson from './permutations-and-combinations/lesson.html';

export const sets: (LearningSet & { lesson: string })[] = [
	{ ...permutationsAndCombinations, lesson: permutationsAndCombinationsLesson },
];

type TaskRow = { slug: string; problemId: string; accepted: number; id: string | null; homeworkId: string; homeworkTitle: string; state: TaskState };
export async function handleSets(request: Request, env: Env, user: SessionUser): Promise<Response | null> {
	const link = /^\/leetcode\/api\/(problems|homework)\/([^/]+)\/sets(?:\/([^/]+))?$/.exec(new URL(request.url).pathname);
	if (link) {
		const homework = link[1] === 'homework', ownerId = uuid(link[2]), slug = link[3];
		const table = homework ? 'homework_sets' : 'problem_sets', field = homework ? 'homework_id' : 'problem_id';
		methods(request, slug ? ['PUT', 'DELETE'] : ['GET']);
		if (homework) await getHomework(env, ownerId); else await getProblem(env, ownerId);
		if (!slug) {
			const linked = new Set((await env.DB.prepare(`SELECT set_slug AS slug FROM ${table} WHERE ${field}=?`).bind(ownerId).all<{ slug: string }>()).results.map(row => row.slug));
			return Response.json(sets.filter(set => linked.has(set.slug)).map(({ slug, title }) => ({ slug, title })));
		}
		requireRole(user, 'parent');
		if (!sets.some(set => set.slug === slug)) throw new HttpError(404, 'not_found', 'This set does not exist.');
		const adding = request.method === 'PUT';
		if (homework) changed((await env.DB.batch([
			env.DB.prepare('UPDATE homework SET version=version+1,updated_at=? WHERE id=? AND version=?').bind(new Date().toISOString(), ownerId, integer(object(await readJson(request), ['version']).version)),
			adding ? env.DB.prepare('INSERT INTO homework_sets SELECT ?,? WHERE changes()=1 ON CONFLICT DO NOTHING').bind(ownerId, slug) : env.DB.prepare('DELETE FROM homework_sets WHERE homework_id=? AND set_slug=? AND changes()=1').bind(ownerId, slug),
		]))[0]);
		else await env.DB.prepare(adding ? 'INSERT INTO problem_sets VALUES (?,?) ON CONFLICT DO NOTHING' : 'DELETE FROM problem_sets WHERE problem_id=? AND set_slug=?').bind(ownerId, slug).run();
		return new Response(null, { status: 204 });
	}
	const match = /^\/leetcode\/api\/sets(?:\/([^/]+)(\/lesson)?)?$/.exec(new URL(request.url).pathname);
	if (!match) return null;
	methods(request, match[2] ? ['GET', 'HEAD'] : ['GET']);
	if (!match[1]) {
		const rows = await env.DB.prepare(`SELECT p.slug FROM problems p WHERE p.slug IN (SELECT value FROM json_each(?)) AND ${solvedSQL}`).bind(JSON.stringify(sets.flatMap(set => set.tasks.map(task => task.slug)))).all<{ slug: string }>();
		const accepted = new Set(rows.results.map(row => row.slug));
		return Response.json(sets.map(({ slug, title, summary, topics, tasks }): LearningSetSummary => ({ slug, title, summary, topics, taskCount: tasks.length, acceptedCount: tasks.filter(task => accepted.has(task.slug)).length })));
	}
	const set = sets.find(item => item.slug === match[1]);
	if (!set) throw new HttpError(404, 'not_found', 'This set does not exist.');
	if (match[2]) return new Response(set.lesson, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': LESSON_CSP } });
	const rows = await env.DB.prepare(`SELECT p.slug,p.id AS problemId,${solvedSQL} AS accepted,t.id,t.homework_id AS homeworkId,h.title AS homeworkTitle,t.state
		FROM problems p LEFT JOIN homework_tasks t ON t.problem_id=p.id AND t.state NOT IN ('completed','cancelled') LEFT JOIN homework h ON h.id=t.homework_id WHERE p.slug IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(set.tasks.map(task => task.slug))).all<TaskRow>();
	const library = new Map(rows.results.map(row => [row.slug, row]));
	const details: LearningSetDetails = { slug: set.slug, title: set.title, summary: set.summary, topics: set.topics, links: set.links, tasks: set.tasks.map(task => {
		const row = library.get(task.slug);
		return { ...task, problemId: row?.problemId ?? null, accepted: Boolean(row?.accepted), activeTask: row?.id ? { id: row.id, homeworkId: row.homeworkId, homeworkTitle: row.homeworkTitle, state: row.state } : null };
	}) };
	return Response.json(details);
}
