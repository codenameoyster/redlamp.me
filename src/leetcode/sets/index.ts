import type { Env } from '../../index';
import type { LearningSet, LearningSetDetails, LearningSetSummary, SessionUser, SetTask, TaskState } from '../../../shared/leetcode';
import { requireRole } from '../auth';
import { getHomework } from '../homework';
import { changed, HttpError, integer, methods, object, readJson, uuid } from '../http';
import LESSON_BRIDGE from '../lesson-bridge.html';
import { getProblem, slug as problemSlug, solvedSQL } from '../problems';
import permutationsAndCombinations from './permutations-and-combinations/set';
import permutationsAndCombinations1 from './permutations-and-combinations/chapter1.html';
import permutationsAndCombinations2 from './permutations-and-combinations/chapter2.html';
import permutationsAndCombinations3 from './permutations-and-combinations/chapter3.html';
import permutationsAndCombinations4 from './permutations-and-combinations/chapter4.html';

export const sets: (LearningSet & { lessons: string[] })[] = [
	{ ...permutationsAndCombinations, lessons: [permutationsAndCombinations1, permutationsAndCombinations2, permutationsAndCombinations3, permutationsAndCombinations4] },
];

export const LESSON_CSP = "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data: blob:; media-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";
export const tasksOf = (set: LearningSet): SetTask[] => set.chapters.flatMap(chapter => chapter.tasks);
export const taskSlug = (task: SetTask): string => problemSlug(task.url);
export function taskLabel(task: SetTask): string {
	const value = taskSlug(task);
	return value.startsWith('cf-') ? `Codeforces ${value.slice(3).replace('-', '').toUpperCase()}` : task.number ? `LeetCode ${task.number}` : 'LeetCode';
}

export async function acceptedSetSlugs(env: Env): Promise<Set<string>> {
	const rows = await env.DB.prepare(`SELECT p.slug FROM problems p WHERE p.slug IN (SELECT value FROM json_each(?)) AND ${solvedSQL}`).bind(JSON.stringify(sets.flatMap(set => tasksOf(set).map(taskSlug)))).all<{ slug: string }>();
	return new Set(rows.results.map(row => row.slug));
}

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
		if (!sets.some(set => set.slug === slug)) throw new HttpError(404, 'not_found', 'Такого набора нет.');
		const adding = request.method === 'PUT';
		if (homework) changed((await env.DB.batch([
			env.DB.prepare('UPDATE homework SET version=version+1,updated_at=? WHERE id=? AND version=?').bind(new Date().toISOString(), ownerId, integer(object(await readJson(request), ['version']).version)),
			adding ? env.DB.prepare('INSERT INTO homework_sets SELECT ?,? WHERE changes()=1 ON CONFLICT DO NOTHING').bind(ownerId, slug) : env.DB.prepare('DELETE FROM homework_sets WHERE homework_id=? AND set_slug=? AND changes()=1').bind(ownerId, slug),
		]))[0]);
		else await env.DB.prepare(adding ? 'INSERT INTO problem_sets VALUES (?,?) ON CONFLICT DO NOTHING' : 'DELETE FROM problem_sets WHERE problem_id=? AND set_slug=?').bind(ownerId, slug).run();
		return new Response(null, { status: 204 });
	}
	const match = /^\/leetcode\/api\/sets(?:\/([^/]+)(?:\/lesson\/([1-9][0-9]?))?)?$/.exec(new URL(request.url).pathname);
	if (!match) return null;
	methods(request, match[2] ? ['GET', 'HEAD'] : ['GET']);
	if (!match[1]) {
		const accepted = await acceptedSetSlugs(env);
		return Response.json(sets.map((set): LearningSetSummary => ({ slug: set.slug, title: set.title, summary: set.summary, topics: set.topics, chapterCount: set.chapters.length, taskCount: tasksOf(set).length, acceptedCount: tasksOf(set).filter(task => accepted.has(taskSlug(task))).length })));
	}
	const set = sets.find(item => item.slug === match[1]);
	if (!set) throw new HttpError(404, 'not_found', 'Такого набора нет.');
	if (match[2]) {
		const lesson = set.lessons[Number(match[2]) - 1];
		if (!lesson) throw new HttpError(404, 'not_found', 'Такой главы нет.');
		return new Response(user.role === 'student' ? lesson + LESSON_BRIDGE : lesson, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': LESSON_CSP } });
	}
	const rows = await env.DB.prepare(`SELECT p.slug,p.id AS problemId,${solvedSQL} AS accepted,t.id,t.homework_id AS homeworkId,h.title AS homeworkTitle,t.state
		FROM problems p LEFT JOIN homework_tasks t ON t.problem_id=p.id AND t.state NOT IN ('completed','cancelled') LEFT JOIN homework h ON h.id=t.homework_id WHERE p.slug IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(tasksOf(set).map(taskSlug))).all<TaskRow>();
	const library = new Map(rows.results.map(row => [row.slug, row]));
	const details: LearningSetDetails = { slug: set.slug, title: set.title, summary: set.summary, topics: set.topics, links: set.links, chapters: set.chapters.map((chapter, index) => ({ number: index + 1, title: chapter.title, summary: chapter.summary, tasks: chapter.tasks.map(task => {
		const value = taskSlug(task), row = library.get(value);
		return { ...task, slug: value, label: taskLabel(task), problemId: row?.problemId ?? null, accepted: Boolean(row?.accepted), activeTask: row?.id ? { id: row.id, homeworkId: row.homeworkId, homeworkTitle: row.homeworkTitle, state: row.state } : null };
	}) })) };
	return Response.json(details);
}
