import { env } from 'cloudflare:workers';
import { beforeEach, expect, it } from 'vitest';
import { login, request } from './client';
import { MAX_LESSON_BYTES, type LearningSetDetails, type LearningSetSummary } from '../shared/leetcode';
import { sets } from '../src/leetcode/sets';
import { LESSON_CSP } from '../src/leetcode/lessons';

let student: string;
const set = sets.find(item => item.slug === 'permutations-and-combinations')!;
const insertProblem = env.DB.prepare("INSERT INTO problems (id,slug,title,difficulty,topics,summary,search_text,created_at,updated_at) VALUES (?,?,'Problem','medium','[]','','','now','now')");
const insertAttempt = env.DB.prepare("INSERT INTO attempts (id,problem_id,state,document,search_text,acceptance,understanding,created_at,updated_at) VALUES (?,?,?,'{}','',?,'with_help','now','now')");
const insertBundle = env.DB.prepare("INSERT INTO homework (id,title,instructions,created_at,updated_at) VALUES (?,?,'','now','now')");
const insertTask = env.DB.prepare("INSERT INTO homework_tasks (id,homework_id,problem_id,state,created_at,updated_at) VALUES (?,?,?,?,'now','now')");
beforeEach(async () => { student = await login(); });
async function addProblem(slug: string, state: string | null, acceptance = 'accepted') {
	const id = crypto.randomUUID();
	await insertProblem.bind(id, slug).run();
	if (state) await insertAttempt.bind(crypto.randomUUID(), id, state, acceptance).run();
	return id;
}

it.each([
	{ name: 'no library problems', problems: [], acceptedCount: 0 },
	{ name: 'accepted set task', problems: [{ slug: 'subsets', state: 'saved', acceptance: 'accepted' }], acceptedCount: 1 },
	{ name: 'two accepted set tasks', problems: [{ slug: 'subsets', state: 'saved', acceptance: 'accepted' }, { slug: 'n-queens', state: 'saved', acceptance: 'accepted' }], acceptedCount: 2 },
	{ name: 'accepted problem outside the set', problems: [{ slug: 'two-sum', state: 'saved', acceptance: 'accepted' }], acceptedCount: 0 },
	{ name: 'saved attempt that is not accepted', problems: [{ slug: 'subsets', state: 'saved', acceptance: 'not_accepted' }], acceptedCount: 0 },
	{ name: 'accepted draft', problems: [{ slug: 'subsets', state: 'draft', acceptance: 'accepted' }], acceptedCount: 0 },
	{ name: 'library problem without attempts', problems: [{ slug: 'subsets', state: null, acceptance: 'accepted' }], acceptedCount: 0 },
])('$name', async ({ problems, acceptedCount }) => {
	for (const problem of problems) await addProblem(problem.slug, problem.state, problem.acceptance);
	const response = await request('/sets', 'GET', undefined, student);
	expect(response.status).toBe(200);
	const items = await response.json() as LearningSetSummary[];
	expect(items.map(item => item.slug)).toEqual(sets.map(item => item.slug));
	expect(items.find(item => item.slug === set.slug)).toEqual({ slug: set.slug, title: set.title, summary: set.summary, topics: set.topics, taskCount: set.tasks.length, acceptedCount });
});

it.each([
	{ name: 'task outside the library', inLibrary: false, acceptance: null, taskState: null, accepted: false, active: false },
	{ name: 'library task without an accepted attempt', inLibrary: true, acceptance: 'not_accepted', taskState: null, accepted: false, active: false },
	{ name: 'accepted library task', inLibrary: true, acceptance: 'accepted', taskState: null, accepted: true, active: false },
	{ name: 'task with an active homework task', inLibrary: true, acceptance: null, taskState: 'changes_requested', accepted: false, active: true },
	{ name: 'completed homework task is not active', inLibrary: true, acceptance: 'accepted', taskState: 'completed', accepted: true, active: false },
])('$name', async ({ inLibrary, acceptance, taskState, accepted, active }) => {
	const other = await addProblem('two-sum', 'saved'), homeworkId = crypto.randomUUID(), taskId = crypto.randomUUID();
	await env.DB.batch([insertBundle.bind(homeworkId, 'Week 41: backtracking'), insertTask.bind(crypto.randomUUID(), homeworkId, other, 'assigned')]);
	const problemId = inLibrary ? await addProblem('subsets', acceptance ? 'saved' : null, acceptance ?? undefined) : null;
	if (taskState) await insertTask.bind(taskId, homeworkId, problemId, taskState).run();
	const response = await request(`/sets/${set.slug}`, 'GET', undefined, student);
	expect(response.status).toBe(200);
	const details = await response.json() as LearningSetDetails;
	expect(details).toMatchObject({ slug: set.slug, title: set.title, summary: set.summary, topics: set.topics, links: set.links });
	expect(details.tasks.map(task => task.slug)).toEqual(set.tasks.map(task => task.slug));
	expect(details.tasks.find(task => task.slug === 'subsets')).toEqual({ ...set.tasks.find(task => task.slug === 'subsets'), problemId, accepted, activeTask: active ? { id: taskId, homeworkId, homeworkTitle: 'Week 41: backtracking', state: taskState } : null });
	expect(details.tasks.filter(task => task.problemId || task.accepted || task.activeTask).map(task => task.slug)).toEqual(inLibrary ? ['subsets'] : []);
});

it('returns the set lesson with the lesson content policy', async () => {
	const response = await request(`/sets/${set.slug}/lesson`, 'GET', undefined, student);
	expect(response.status).toBe(200);
	expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
	expect(response.headers.get('content-security-policy')).toBe(LESSON_CSP);
	expect(await response.text()).toBe(set.lesson);
});

it.each([
	{ name: 'unknown set', path: '/sets/missing-set', signedIn: true, status: 404, code: 'not_found' },
	{ name: 'unknown set lesson', path: '/sets/missing-set/lesson', signedIn: true, status: 404, code: 'not_found' },
	{ name: 'anonymous set list', path: '/sets', signedIn: false, status: 401, code: 'unauthorized' },
	{ name: 'anonymous set', path: '/sets/permutations-and-combinations', signedIn: false, status: 401, code: 'unauthorized' },
	{ name: 'anonymous set lesson', path: '/sets/permutations-and-combinations/lesson', signedIn: false, status: 401, code: 'unauthorized' },
])('$name', async ({ path, signedIn, status, code }) => {
	const response = await request(path, 'GET', undefined, signedIn ? student : '');
	expect(response.status).toBe(status);
	expect(await response.json()).toMatchObject({ error: { code } });
});

const slugFormat = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
it.each(sets.map(item => ({ name: item.slug, item })))('$name content', ({ item }) => {
	expect(sets.filter(other => other.slug === item.slug)).toHaveLength(1);
	expect(item.slug).toMatch(slugFormat);
	expect(item.tasks.filter(task => !slugFormat.test(task.slug)).map(task => task.slug)).toEqual([]);
	expect(item.tasks.filter((task, index) => item.tasks.findIndex(other => other.slug === task.slug) !== index).map(task => task.slug)).toEqual([]);
	expect(item.tasks.filter(task => !task.stage.trim()).map(task => task.slug)).toEqual([]);
	expect(item.links.filter(link => new URL(link.url).protocol !== 'https:').map(link => link.url)).toEqual([]);
	expect(new TextEncoder().encode(item.lesson).byteLength).toBeLessThanOrEqual(MAX_LESSON_BYTES);
});

const linkedSet = { slug: 'permutations-and-combinations', title: 'Permutations and combinations' };
it.each([
	{ name: 'parent links a set to a problem', owner: 'problems', role: 'parent', method: 'PUT', slug: linkedSet.slug, before: false, version: 1, expected: 204, linked: [linkedSet], homeworkVersion: 1 },
	{ name: 'parent links a set to homework', owner: 'homework', role: 'parent', method: 'PUT', slug: linkedSet.slug, before: false, version: 1, expected: 204, linked: [linkedSet], homeworkVersion: 2 },
	{ name: 'stale homework set link', owner: 'homework', role: 'parent', method: 'PUT', slug: linkedSet.slug, before: false, version: 2, expected: 409, linked: [], homeworkVersion: 1 },
	{ name: 'unknown set', owner: 'problems', role: 'parent', method: 'PUT', slug: 'missing-set', before: false, version: 1, expected: 404, linked: [], homeworkVersion: 1 },
	{ name: 'student cannot link a set', owner: 'problems', role: 'student', method: 'PUT', slug: linkedSet.slug, before: false, version: 1, expected: 403, linked: [], homeworkVersion: 1 },
	{ name: 'parent unlinks a set from a problem', owner: 'problems', role: 'parent', method: 'DELETE', slug: linkedSet.slug, before: true, version: 1, expected: 204, linked: [], homeworkVersion: 1 },
	{ name: 'parent unlinks a set from homework', owner: 'homework', role: 'parent', method: 'DELETE', slug: linkedSet.slug, before: true, version: 1, expected: 204, linked: [], homeworkVersion: 2 },
])('$name', async ({ owner, role, method, slug, before, version, expected, linked, homeworkVersion }) => {
	const parent = await login('parent'), problemId = await addProblem('subsets', null), homeworkId = crypto.randomUUID();
	await insertBundle.bind(homeworkId, 'Week 41').run();
	const ownerId = owner === 'homework' ? homeworkId : problemId;
	if (before) await env.DB.prepare(`INSERT INTO ${owner === 'homework' ? 'homework_sets' : 'problem_sets'} VALUES (?,?)`).bind(ownerId, slug).run();
	expect((await request(`/${owner}/${ownerId}/sets/${slug}`, method, owner === 'homework' ? { version } : {}, role === 'parent' ? parent : student)).status).toBe(expected);
	expect(await (await request(`/${owner}/${ownerId}/sets`, 'GET', undefined, student)).json()).toEqual(linked);
	expect(await env.DB.prepare('SELECT version FROM homework WHERE id=?').bind(homeworkId).first()).toEqual({ version: homeworkVersion });
});
