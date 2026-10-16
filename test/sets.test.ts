import { env } from 'cloudflare:workers';
import { beforeEach, expect, it } from 'vitest';
import { login, request } from './client';
import type { FigureRow, LearningSetDetails, LearningSetSummary, SetTask } from '../shared/leetcode';
import { glossary } from '../shared/glossary';
import { parsePy, reprPy } from '../src/leetcode/pyliteral';
import { mulberry32 } from '../src/leetcode/judge';
import { generatorOf, referenceOf, sets, taskLabel, taskSlug, tasksOf, type Reference } from '../src/leetcode/sets';
import { expectedOf } from '../src/leetcode/tests';
import { htmlText } from '../src/leetcode/tutor';

let student: string;
const set = sets.find(item => item.slug === 'permutations-and-combinations')!;
const twoPointers = sets.find(item => item.slug === 'two-pointers')!;
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
	expect(items.find(item => item.slug === set.slug)).toEqual({ slug: set.slug, title: set.title, summary: set.summary, topics: set.topics, chapterCount: 4, taskCount: tasksOf(set).length, acceptedCount });
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
	expect(details).toMatchObject({ slug: set.slug, title: set.title, summary: set.summary, topics: set.topics });
	expect(details.chapters.map(chapter => chapter.links)).toEqual(set.chapters.map(chapter => chapter.links));
	expect(details.chapters.map(chapter => ({ number: chapter.number, title: chapter.title, summary: chapter.summary, tasks: chapter.tasks.map(task => task.slug) }))).toEqual([
		{ number: 1, title: 'Считаем варианты', summary: 'Прежде чем писать перебор, посчитайте варианты. Правило произведения, правило суммы, факториал, выбор по порядку и без порядка, подмножества.', tasks: ['cf-1821-a', 'cf-1743-a', 'cf-629-a', 'cf-1674-b', 'number-of-good-pairs'] },
		{ number: 2, title: 'Перебор: подмножества, перестановки, сочетания', summary: 'Один шаблон на Python выписывает все варианты: выбрать, пойти глубже, отменить. Индекс start даёт наборы без порядка, список used даёт перестановки.', tasks: ['letter-case-permutation', 'subsets', 'permutations', 'combinations', 'letter-combinations-of-a-phone-number'] },
		{ number: 3, title: 'Повторы и отсечения', summary: 'Если во входе есть одинаковые числа, перебор даёт одинаковые ответы. Сортировка и пропуск убирают повторы, а отсечение останавливает бесполезные ветки.', tasks: ['subsets-ii', 'permutations-ii', 'combination-sum', 'generate-parentheses', 'cf-1097-b'] },
		{ number: 4, title: 'Порядок и номер', summary: 'Следующая перестановка, пути в сетке, k-я перестановка и ферзи. Вы находите один вариант или число вариантов без списка всех.', tasks: ['next-permutation', 'unique-paths', 'permutation-sequence', 'n-queens'] },
	]);
	const rows = details.chapters.flatMap(chapter => chapter.tasks);
	expect(rows.find(task => task.slug === 'subsets')).toEqual({ ...set.chapters[1].tasks.find(task => taskSlug(task) === 'subsets'), slug: 'subsets', label: 'LeetCode 78', problemId, accepted, activeTask: active ? { state: taskState } : null });
	expect(rows.filter(task => task.problemId || task.accepted || task.activeTask).map(task => task.slug)).toEqual(inLibrary ? ['subsets'] : []);
});

it.each([
	{ name: 'student chapter 1 lesson', role: 'student', item: set, chapter: '1', body: { html: set.lessons[0], figures: [] } },
	{ name: 'parent chapter 4 lesson', role: 'parent', item: set, chapter: '4', body: { html: set.lessons[3], figures: [] } },
	{ name: 'lesson with figures', role: 'student', item: twoPointers, chapter: '1', body: { html: twoPointers.lessons[0], figures: twoPointers.chapters[0].figures } },
	{ name: 'chapter 5 is missing', role: 'parent', item: set, chapter: '5', body: null },
	{ name: 'chapter 0 is missing', role: 'parent', item: set, chapter: '0', body: null },
	{ name: 'chapter x is missing', role: 'parent', item: set, chapter: 'x', body: null },
	{ name: 'lesson without a chapter number is missing', role: 'parent', item: set, chapter: '', body: null },
])('$name', async ({ role, item, chapter, body }) => {
	const response = await request(`/sets/${item.slug}/lesson${chapter && `/${chapter}`}`, 'GET', undefined, role === 'parent' ? await login('parent') : student);
	if (body === null) { expect(response.status).toBe(404); expect(await response.json()).toMatchObject({ error: { code: 'not_found' } }); return; }
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual(body);
});

it.each([
	{ name: 'unknown set', path: '/sets/missing-set', signedIn: true, status: 404, code: 'not_found' },
	{ name: 'unknown set lesson', path: '/sets/missing-set/lesson/1', signedIn: true, status: 404, code: 'not_found' },
	{ name: 'anonymous set list', path: '/sets', signedIn: false, status: 401, code: 'unauthorized' },
	{ name: 'anonymous set', path: '/sets/permutations-and-combinations', signedIn: false, status: 401, code: 'unauthorized' },
	{ name: 'anonymous set lesson', path: '/sets/permutations-and-combinations/lesson/1', signedIn: false, status: 401, code: 'unauthorized' },
])('$name', async ({ path, signedIn, status, code }) => {
	const response = await request(path, 'GET', undefined, signedIn ? student : '');
	expect(response.status).toBe(status);
	expect(await response.json()).toMatchObject({ error: { code } });
});

// The set files write Python literals in the JSON form with True and False. A failed parse gives undefined.
const pythonLiteral = (text: string): unknown => { try { return JSON.parse(text.replace(/"(?:[^"\\]|\\.)*"|\b(?:True|False|true|false|null)\b/g, token => token.startsWith('"') ? token : token === 'True' ? 'true' : token === 'False' ? 'false' : '?')); } catch { return undefined; } };
// A row index must point to a cell of the row. A window starts at or before its end. A tree row has no pointers and no window.
const badRow = (row: FigureRow) => !row.cells.length || (row.tree === true && (row.pointers !== undefined || row.window !== undefined)) || (row.window !== undefined && row.window[0] > row.window[1]) || [...row.marked ?? [], ...row.dimmed ?? [], ...Object.values(row.pointers ?? {}), ...row.window ?? []].some(index => index === undefined || !Number.isInteger(index) || index < 0 || index >= row.cells.length);
const slugFormat = /^[a-z0-9]+(?:-[a-z0-9]+)*$/, fragmentTag = /^(?:h2|h3|p|ul|ol|li|table|caption|thead|tbody|tr|th|td|pre|code|strong|em|sup|blockquote|details|summary|a|br|div|figure)$/, statementTag = /^(?:h3|p|ul|ol|li|table|thead|tbody|tr|th|td|pre|code|strong|em|sup|sub)$/;
it.each(sets.map(item => ({ name: item.slug, item })))('$name content', ({ item }) => {
	expect(sets.filter(other => other.slug === item.slug)).toHaveLength(1);
	expect(item.slug).toMatch(slugFormat);
	const tasks = tasksOf(item);
	expect(tasks.filter(task => !slugFormat.test(taskSlug(task))).map(taskSlug)).toEqual([]);
	expect(tasks.filter((task, index) => tasks.findIndex(other => taskSlug(other) === taskSlug(task)) !== index).map(taskSlug)).toEqual([]);
	expect(tasks.filter(task => !task.tests || task.tests.cases.length < 4 || task.tests.cases.length > 6 || (task.tests.mode === 'stdio') !== taskSlug(task).startsWith('cf-') || task.tests.mode === 'call' && !/^[a-z][A-Za-z]*$/.test(task.tests.method)).map(taskSlug)).toEqual([]);
	expect(tasks.flatMap(({ tests, ...task }) => !tests ? [] : tests.cases.filter(item => item.expected === null || (tests.mode === 'call' ? !Array.isArray(pythonLiteral(item.input)) || pythonLiteral(item.expected) === undefined : !item.input.endsWith('\n') || !item.expected.trim())).map(item => `${taskSlug(task)}: ${item.input}`))).toEqual([]);
	// The work window renders the statement as HTML, so a tag outside the list or any attribute fails.
	expect(tasks.filter(({ statement = '' }) => !statement.includes('<h3>Пример 1</h3>') || !statement.includes('<h3>Ограничения</h3>') || [...statement.matchAll(/<([^\s/>]+)([^>]*)>/g)].some(([, tag, rest]) => !statementTag.test(tag) || rest)).map(taskSlug)).toEqual([]);
	expect(item.chapters.filter(chapter => !chapter.title.trim() || !chapter.summary.trim()).map(chapter => chapter.title)).toEqual([]);
	expect(item.chapters.filter(chapter => chapter.tasks.length < 3 || chapter.tasks.length > 5 || chapter.cards.length < 6 || chapter.cards.length > 8).map(chapter => chapter.title)).toEqual([]);
	const links = item.chapters.flatMap(chapter => chapter.links);
	expect(item.chapters.filter(chapter => chapter.links.length < 3 || chapter.links.length > 5).map(chapter => chapter.title)).toEqual([]);
	expect(links.filter(link => new URL(link.url).protocol !== 'https:').map(link => link.url)).toEqual([]);
	expect(links.filter((link, index) => links.findIndex(other => other.url === link.url) !== index).map(link => link.url)).toEqual([]);
	expect(item.lessons).toHaveLength(item.chapters.length);
	expect(item.lessons.map(lesson => htmlText(lesson).length).filter(length => length >= 6000)).toEqual([]);
	expect(item.lessons.flatMap(lesson => [...lesson.matchAll(/<([a-z][a-z0-9]*)/gi)].map(match => match[1]).filter(tag => !fragmentTag.test(tag)))).toEqual([]);
	expect(item.lessons.flatMap((lesson, index) => lesson.startsWith('<p class="lead">') && !/\s(?:style|on[a-z]+)=|<div(?! class="rule">)/i.test(lesson) ? [] : [index + 1])).toEqual([]);
	// A figure is an empty placeholder on its own line. The placeholders follow the order of chapter.figures.
	expect(item.lessons.map(lesson => (lesson.match(/<figure\b/g) ?? []).length - (lesson.match(/^<figure data-figure="[a-z0-9-]+"><\/figure>$/gm) ?? []).length)).toEqual(item.lessons.map(() => 0));
	expect(item.lessons.map(lesson => [...lesson.matchAll(/data-figure="([^"]+)"/g)].map(match => match[1]))).toEqual(item.chapters.map(chapter => (chapter.figures ?? []).map(figure => figure.id)));
	const figures = item.chapters.flatMap(chapter => chapter.figures ?? []);
	expect(figures.filter(figure => !slugFormat.test(figure.id) || !figure.title.trim() || !figure.frames.length || figure.frames.some(frame => !frame.caption.trim() || !frame.rows.length || frame.rows.some(badRow))).map(figure => figure.id)).toEqual([]);
});

// The hard words that need a tip in shared/glossary.ts. The list also has words that no set uses yet, so a new set with such a word fails until the word gets a tip.
// An English name of a data structure is a word of its own: heapq, dequeue, collections.deque, deque(...) and deque.popleft are code.
const hardWord = /(?<!\p{L})(?:инвариант|O\(|log|метод|(?<![\d_.])(?:(?:heap|deque|queue|stack)s?|monotonic|priority)(?![\p{L}\d_(]|\.\p{L})|монотонн|жадн|моделир|кортеж|рекурс|перебор\p{L}*\s+с\s+возврат|отсеч|трассир|подмассив|подпоследовательн|лексикограф|ленив|индекс|факториал|перестановк|подмножеств|скользящ|ASCII|регистр|слияни|32-бит|линейн|переполн|амортиз|асимптот|мемоиз|итератор|компаратор|эвристик|коллизи|логарифм|граф|бинарн)/giu;
// The hard words of the text that no match of the patterns covers.
const untipped = (text: string, patterns: RegExp[]) => [...text.matchAll(hardWord)].filter(word => !patterns.some(pattern => [...text.matchAll(pattern)].some(match => match.index <= word.index && word.index < match.index + match[0].length))).map(word => word[0]);
// Code is not prose. The text of the other tags stays.
const prose = (html: string) => html.replace(/<(pre|code)\b[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, '');
it.each(sets.map(item => ({ name: item.slug, item })))('$name hard words have a tip', ({ item }) => {
	const patterns = glossary.map(entry => entry.pattern);
	const texts = [['summary', item.summary], ...item.chapters.flatMap((chapter, index) => [
		[`chapter ${index + 1} summary`, chapter.summary], [`chapter ${index + 1} lesson`, prose(item.lessons[index])],
		...chapter.tasks.flatMap(task => [[`${taskSlug(task)} statement`, prose(task.statement ?? '')], [`${taskSlug(task)} note`, task.note]]),
		...chapter.cards.flatMap(card => [[`${card.id} prompt`, card.prompt], [`${card.id} explain`, card.explain]]),
	])];
	expect(texts.flatMap(([place, text]) => untipped(text, patterns).map(word => `${place}: ${word}`))).toEqual([]);
});

// The sets name the data structures in English. The external link titles are not set text.
const russianName = /(?<!\p{L})(?:куч(?:а|и|е|у|ей|ею|ам|ами|ах)?|дек(?:а|е|у|ом|и|ов|ам|ами|ах)?|стек(?:а|е|у|ом|и|ов|ам|ами|ах)?)(?!\p{L})/giu;
const strings = (value: unknown): string[] => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
it.each(sets.map(item => ({ name: item.slug, item })))('$name names the data structures in English', ({ item }) => {
	expect(strings({ ...item, chapters: item.chapters.map(chapter => ({ ...chapter, links: [] })) }).flatMap(text => text.match(russianName) ?? [])).toEqual([]);
});

it('each tip is plain', () => {
	expect(glossary.filter(entry => /[–—]/.test(entry.tip) || untipped(entry.tip, [entry.pattern]).length).map(entry => entry.tip)).toEqual([]);
});

// The harness sorts the answer for the orders 'any' and 'any-nested'. A sort by the Python text gives the same equality.
const ordered = (value: unknown, order = 'exact'): string => order === 'exact' ? reprPy(value) : JSON.stringify((value as unknown[]).map(item => order === 'any' ? reprPy(item) : JSON.stringify((item as unknown[]).map(reprPy).sort())).sort());
it.each(sets.flatMap(tasksOf).map(task => ({ name: taskSlug(task), task })))('$name reference passes the standard tests', ({ task }) => {
	const tests = task.tests!, reference = referenceOf(taskSlug(task));
	expect(reference?.mode).toBe(tests.mode);
	// The answer goes through the expected route path: the stdout text or the Python text of the value. Stdout compares token by token.
	const form = (text: string) => tests.mode === 'stdio' ? text.split(/\s+/).filter(Boolean).join(' ') : ordered(parsePy(text), tests.order);
	expect(tests.cases.map(item => { const answer = expectedOf(reference!, item.input); return answer && 'value' in answer ? form(answer.value) : answer; })).toEqual(tests.cases.map(item => form(item.expected!)));
});

// The hidden tests of seeds 1 and 2^32 - 1. Each input must have the argument count of the reference and satisfy the constraints. A reference run of 100 ms or more makes the judge route slow.
// The judge route refuses an output over 1,000,000 characters, so a longer answer can never pass.
it.each(sets.flatMap(tasksOf).map(task => ({ name: taskSlug(task), task })))('$name generator gives valid hidden tests', ({ task }) => {
	const reference = referenceOf(taskSlug(task))!, generate = generatorOf(taskSlug(task)), inputs = generate?.(mulberry32(1)) ?? [];
	expect(inputs.length).toBeGreaterThanOrEqual(10);
	expect(inputs.length).toBeLessThanOrEqual(16);
	expect([...inputs, ...generate?.(mulberry32(2 ** 32 - 1)) ?? []].flatMap((input, index) => {
		const args = reference.mode === 'call' ? parsePy(input) as unknown[] : [input], start = performance.now();
		if (args.length !== reference.solve.length) return [index];
		const expected = reference.mode === 'stdio' ? reference.solve(input) : reprPy(reference.solve(...args));
		return performance.now() - start < 100 && expected.length <= 1_000_000 ? [] : [index];
	})).toEqual([]);
});

const task: Omit<SetTask, 'url' | 'number'> = { title: 'Task', difficulty: 'easy', topics: [], note: '' };
it.each([
	{ name: 'LeetCode task with a number', url: 'https://leetcode.com/problems/subsets/', number: 78, slug: 'subsets', label: 'LeetCode 78' },
	{ name: 'LeetCode task without a number', url: 'https://leetcode.com/problems/subsets/', number: undefined, slug: 'subsets', label: 'LeetCode' },
	{ name: 'Codeforces task', url: 'https://codeforces.com/contest/1234/problem/B1', number: undefined, slug: 'cf-1234-b1', label: 'Codeforces 1234B1' },
])('$name', ({ url, number, slug, label }) => {
	expect(taskSlug({ ...task, url, number })).toBe(slug);
	expect(taskLabel({ ...task, url, number })).toBe(label);
});

const linkedSet = { slug: 'permutations-and-combinations', title: 'Перестановки и сочетания' };
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
	expect((await (await request(`/${owner}/${ownerId}/sets`, 'GET', undefined, student)).json() as { sets: unknown }).sets).toEqual(linked);
	expect(await env.DB.prepare('SELECT version FROM homework WHERE id=?').bind(homeworkId).first()).toEqual({ version: homeworkVersion });
});

const chapter2 = { set: 'permutations-and-combinations', setTitle: 'Перестановки и сочетания', number: 2, title: 'Перебор: подмножества, перестановки, сочетания' };
const chapter3 = { ...chapter2, number: 3, title: 'Повторы и отсечения' };
it.each([
	{ name: 'problem in a chapter', owner: 'problems', slugs: ['subsets'], chapters: [chapter2] },
	{ name: 'problem in no chapter', owner: 'problems', slugs: ['two-sum'], chapters: [] },
	{ name: 'homework with tasks in two chapters', owner: 'homework', slugs: ['subsets-ii', 'two-sum', 'subsets', 'permutations'], chapters: [chapter3, chapter2] },
])('$name', async ({ owner, slugs, chapters }) => {
	const homeworkId = crypto.randomUUID(), problemIds: string[] = [];
	for (const slug of slugs) problemIds.push(await addProblem(slug, null));
	// Reverse insert order, so only created_at gives the task order.
	await env.DB.batch([insertBundle.bind(homeworkId, 'Week 41'), ...problemIds.map((id, index) => env.DB.prepare("INSERT INTO homework_tasks (id,homework_id,problem_id,state,created_at,updated_at) VALUES (?,?,?,'assigned',?,'now')").bind(crypto.randomUUID(), homeworkId, id, `2026-10-1${index}`)).reverse()]);
	const response = await request(`/${owner}/${owner === 'homework' ? homeworkId : problemIds[0]}/sets`, 'GET', undefined, student);
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ chapters, sets: [] });
});

// Wrong solutions of LeetCode 2462 that pass the examples of the statement. The hidden tests of every seed must reject them.
function rightTie(costs: number[], k: number, candidates: number) {
	const left: number[] = [], right: number[] = [], least = (group: number[]) => group.reduce((best, i) => costs[i] < costs[best] || (costs[i] === costs[best] && i < best) ? i : best);
	let l = 0, r = costs.length - 1, total = 0;
	for (; l < candidates && l <= r; l++) left.push(l);
	for (; costs.length - 1 - r < candidates && l <= r; r--) right.push(r);
	for (let hired = 0; hired < k; hired++) {
		const fromLeft = !right.length || (left.length > 0 && costs[least(left)] < costs[least(right)]), group = fromLeft ? left : right, i = least(group);
		group.splice(group.indexOf(i), 1);
		total += costs[i];
		if (l <= r) group.push(fromLeft ? l++ : r--);
	}
	return total;
}
it.each([
	{ name: 'sum of the k cheapest costs', wrong: (costs: number[], k: number) => [...costs].sort((a, b) => a - b).slice(0, k).reduce((sum, cost) => sum + cost, 0) },
	{ name: 'tie that goes to the right group', wrong: rightTie },
])('LeetCode 2462 rejects the $name', ({ wrong }) => {
	const slug = 'total-cost-to-hire-k-workers', reference = referenceOf(slug) as Extract<Reference, { mode: 'call' }>, generate = generatorOf(slug)!;
	for (let seed = 1; seed <= 50; seed++) {
		const small = generate(mulberry32(seed)).filter(input => input.length <= 1000).map(input => parsePy(input) as [number[], number, number]);
		expect(small.some(([costs, k, candidates]) => wrong(costs, k, candidates) !== reference.solve(costs, k, candidates)), `seed ${seed}`).toBe(true);
	}
});

it('card ids are unique across all sets', () => {
	const ids = sets.flatMap(item => item.chapters.flatMap(chapter => chapter.cards.map(card => card.id)));
	expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
});

it('figure ids are unique across all sets', () => {
	const ids = sets.flatMap(item => item.chapters.flatMap(chapter => (chapter.figures ?? []).map(figure => figure.id)));
	expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
});

it.each(sets.flatMap(item => item.chapters.map((chapter, index) => ({ name: `${item.slug}-${index + 1} deck`, cards: chapter.cards }))))('$name has consistent cards', ({ cards }) => {
	expect(cards.length).toBeGreaterThan(0);
	expect(cards.filter(card => !card.explain.trim())).toEqual([]);
	expect(cards.filter(card => (card.type === 'choice' || card.type === 'code') && !(card.answer >= 0 && card.answer < card.options.length))).toEqual([]);
	// A code card shows code to read, or code with one blank to fill.
	expect(cards.filter(card => card.type === 'code' && card.code.split('___').length > 2)).toEqual([]);
	// The grader compares the whole answer string, so a short answer is one integer: "3, 1, 4" typed as "3,1,4" would be wrong.
	expect(cards.filter(card => card.type === 'short' && !/^-?\d+$/.test(card.answer))).toEqual([]);
});
