import type { Env } from '../../index';
import type { ChapterRef, LearningSet, LearningSetDetails, LearningSetSummary, SessionUser, SetTask, TaskState } from '../../../shared/leetcode';
import { requireRole } from '../auth';
import { getHomework } from '../homework';
import { changed, HttpError, integer, methods, object, readJson, uuid } from '../http';
import { getProblem, slug as problemSlug, solvedSQL } from '../problems';
import heapsAndQueues from './heaps-and-queues/set';
import heapsAndQueues1 from './heaps-and-queues/chapter1.html';
import heapsAndQueues2 from './heaps-and-queues/chapter2.html';
import heapsAndQueues3 from './heaps-and-queues/chapter3.html';
import heapsAndQueuesGenerators from './heaps-and-queues/generators';
import heapsAndQueuesSolutions from './heaps-and-queues/solutions';
import permutationsAndCombinations from './permutations-and-combinations/set';
import permutationsAndCombinations1 from './permutations-and-combinations/chapter1.html';
import permutationsAndCombinations2 from './permutations-and-combinations/chapter2.html';
import permutationsAndCombinations3 from './permutations-and-combinations/chapter3.html';
import permutationsAndCombinations4 from './permutations-and-combinations/chapter4.html';
import permutationsAndCombinationsGenerators from './permutations-and-combinations/generators';
import permutationsAndCombinationsSolutions from './permutations-and-combinations/solutions';
import twoPointers from './two-pointers/set';
import twoPointers1 from './two-pointers/chapter1.html';
import twoPointers2 from './two-pointers/chapter2.html';
import twoPointers3 from './two-pointers/chapter3.html';
import twoPointers4 from './two-pointers/chapter4.html';
import twoPointersGenerators from './two-pointers/generators';
import twoPointersSolutions from './two-pointers/solutions';

export const sets: (LearningSet & { lessons: string[] })[] = [
	{ ...permutationsAndCombinations, lessons: [permutationsAndCombinations1, permutationsAndCombinations2, permutationsAndCombinations3, permutationsAndCombinations4] },
	{ ...twoPointers, lessons: [twoPointers1, twoPointers2, twoPointers3, twoPointers4] },
	{ ...heapsAndQueues, lessons: [heapsAndQueues1, heapsAndQueues2, heapsAndQueues3] },
];

// A reference solution of a set task. A call input gives solve.length arguments. solve returns the value that the harness compares and throws RangeError('constraints') for an input outside the statement constraints.
// The references stay on the server, so the student cannot read them.
export type Reference = { mode: 'call'; solve: (...args: unknown[]) => unknown } | { mode: 'stdio'; solve: (stdin: string) => string };
const references = new Map<string, Reference>(Object.entries({ ...permutationsAndCombinationsSolutions, ...twoPointersSolutions, ...heapsAndQueuesSolutions }));
export const referenceOf = (slug: string): Reference | undefined => references.get(slug);
// A generator of the hidden tests of a set task: 10 to 16 inputs in the test format of the task. random is a seeded PRNG.
export type Generator = (random: () => number) => string[];
const generators = new Map<string, Generator>(Object.entries({ ...permutationsAndCombinationsGenerators, ...twoPointersGenerators, ...heapsAndQueuesGenerators }));
export const generatorOf = (slug: string): Generator | undefined => generators.get(slug);

export const tasksOf = (set: LearningSet): SetTask[] => set.chapters.flatMap(chapter => chapter.tasks);
export const taskSlug = (task: SetTask): string => problemSlug(task.url);
export const chaptersOf = (slug: string): ChapterRef[] => sets.flatMap(set => set.chapters.flatMap((chapter, index) => chapter.tasks.some(task => taskSlug(task) === slug) ? [{ set: set.slug, setTitle: set.title, number: index + 1, title: chapter.title }] : []));
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
		const owner = homework ? await getHomework(env, ownerId) : await getProblem(env, ownerId);
		if (!slug) {
			const linked = new Set((await env.DB.prepare(`SELECT set_slug AS slug FROM ${table} WHERE ${field}=?`).bind(ownerId).all<{ slug: string }>()).results.map(row => row.slug));
			const problems = 'slug' in owner ? [owner] : (await env.DB.prepare('SELECT p.slug FROM homework_tasks t JOIN problems p ON p.id=t.problem_id WHERE t.homework_id=? ORDER BY t.created_at,t.id').bind(ownerId).all<{ slug: string }>()).results;
			const chapters = [...new Map(problems.flatMap(problem => chaptersOf(problem.slug)).map(chapter => [`${chapter.set}/${chapter.number}`, chapter])).values()];
			return Response.json({ chapters, sets: sets.filter(set => linked.has(set.slug)).map(({ slug, title }) => ({ slug, title })) });
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
	methods(request, ['GET']);
	if (!match[1]) {
		const accepted = await acceptedSetSlugs(env);
		return Response.json(sets.map((set): LearningSetSummary => ({ slug: set.slug, title: set.title, summary: set.summary, topics: set.topics, chapterCount: set.chapters.length, taskCount: tasksOf(set).length, acceptedCount: tasksOf(set).filter(task => accepted.has(taskSlug(task))).length })));
	}
	const set = sets.find(item => item.slug === match[1]);
	if (!set) throw new HttpError(404, 'not_found', 'Такого набора нет.');
	if (match[2]) {
		const html = set.lessons[Number(match[2]) - 1];
		if (!html) throw new HttpError(404, 'not_found', 'Такой главы нет.');
		return Response.json({ html, figures: set.chapters[Number(match[2]) - 1].figures ?? [] });
	}
	const rows = await env.DB.prepare(`SELECT p.slug,p.id AS problemId,${solvedSQL} AS accepted,t.id,t.homework_id AS homeworkId,h.title AS homeworkTitle,t.state
		FROM problems p LEFT JOIN homework_tasks t ON t.problem_id=p.id AND t.state NOT IN ('completed','cancelled') LEFT JOIN homework h ON h.id=t.homework_id WHERE p.slug IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(tasksOf(set).map(taskSlug))).all<TaskRow>();
	const library = new Map(rows.results.map(row => [row.slug, row]));
	const details: LearningSetDetails = { slug: set.slug, title: set.title, summary: set.summary, topics: set.topics, chapters: set.chapters.map((chapter, index) => ({ number: index + 1, title: chapter.title, summary: chapter.summary, links: chapter.links, tasks: chapter.tasks.map(task => {
		const value = taskSlug(task), row = library.get(value);
		return { ...task, slug: value, label: taskLabel(task), problemId: row?.problemId ?? null, accepted: Boolean(row?.accepted), activeTask: row?.id ? { id: row.id, homeworkId: row.homeworkId, homeworkTitle: row.homeworkTitle, state: row.state } : null };
	}) })) };
	return Response.json(details);
}
