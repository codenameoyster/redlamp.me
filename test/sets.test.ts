import { env } from 'cloudflare:workers';
import { beforeEach, expect, it } from 'vitest';
import { login, request } from './client';
import type { FigureRow, LearningSetDetails, LearningSetSummary, SetTask } from '../shared/leetcode';
import { glossary } from '../shared/glossary';
import { normalizeTopics } from '../shared/topics';
import { parsePy, reprPy, same } from '../shared/answers';
import { expectedOf, mulberry32 } from '../src/leetcode/judge';
import { contentOf, sets, taskLabel, taskSlug, tasksOf, type Reference } from '../src/leetcode/sets';
import { htmlText } from '../src/leetcode/tutor';

let student: string;
const set = sets.find(item => item.slug === 'permutations-and-combinations')!;
const twoPointers = sets.find(item => item.slug === 'two-pointers')!;

it.each(sets.flatMap(item => item.chapters.map((chapter, index) => ({ name: `${item.slug}/${index + 1}`, chapter }))))('$name states problem costs with English topics', ({ chapter }) => {
	expect(chapter.tasks.filter(task => !/Время:/.test(task.note) || !/Память:/.test(task.note) || !/O\(/.test(task.note)).map(taskSlug)).toEqual([]);
	expect(chapter.tasks.filter(task => task.topics.some(topic => /[а-яё]/i.test(topic)) || new Set(task.topics).size !== task.topics.length).map(taskSlug)).toEqual([]);
	expect(chapter.lesson).toContain('Дополнительная память');
});

it.each([
	{ name: 'in-place problem with its ordering lesson', slug: 'next-permutation', spec: { mode: 'call', method: 'nextPermutation', check: 'arg0' }, input: '[[1, 2, 3]]', answer: '[1, 3, 2]', chapter: 4, title: 'Порядок и номер', lesson: '2. Next Permutation' },
	{ name: 'standard-input problem with its counting lesson', slug: 'cf-1821-a', spec: { mode: 'stdio' }, input: '2\n??\n0\n', answer: '90\n0\n', chapter: 1, title: 'Считаем варианты', lesson: '2. Product Rule' },
])('resolves $name', ({ slug, spec, input, answer, chapter, title, lesson }) => {
	const content = contentOf(slug)!;
	expect(content.task.tests).toMatchObject(spec);
	expect(expectedOf(content.reference!, input)).toEqual({ value: answer });
	expect(content.chapters.map(item => item.ref)).toEqual([{ set: 'permutations-and-combinations', setTitle: 'Permutations и Combinations', number: chapter, title }]);
	expect(content.chapters[0].lesson).toContain(lesson);
});

it('returns no learning material for a problem outside the sets', () => {
	expect(contentOf('two-sum')).toBeUndefined();
});

it('uses each canonical problem in only one chapter across all sets', () => {
	const entries = sets.flatMap(item => item.chapters.flatMap((chapter, index) => chapter.tasks.map(task => ({ slug: taskSlug(task), chapter: `${item.slug}/${index + 1}` }))));
	expect(entries.filter((entry, index) => entries.findIndex(other => other.slug === entry.slug) !== index)).toEqual([]);
});

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
	{ name: 'task outside the library', inLibrary: false, acceptance: null, taskState: null, accepted: false, active: false, assignable: true },
	{ name: 'library task without an accepted attempt', inLibrary: true, acceptance: 'not_accepted', taskState: null, accepted: false, active: false, assignable: true },
	{ name: 'accepted library task', inLibrary: true, acceptance: 'accepted', taskState: null, accepted: true, active: false, assignable: false },
	{ name: 'task with an active homework task', inLibrary: true, acceptance: null, taskState: 'changes_requested', accepted: false, active: true, assignable: false },
	{ name: 'completed homework task is not active', inLibrary: true, acceptance: 'accepted', taskState: 'completed', accepted: true, active: false, assignable: false },
	{ name: 'completed homework without acceptance', inLibrary: true, acceptance: null, taskState: 'completed', accepted: false, active: false, assignable: false },
	{ name: 'cancelled unsolved homework', inLibrary: true, acceptance: null, taskState: 'cancelled', accepted: false, active: false, assignable: true },
])('$name', async ({ inLibrary, acceptance, taskState, accepted, active, assignable }) => {
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
		{ number: 1, title: 'Считаем варианты', summary: 'Считаем операции и память: Linear Scan, Product Rule, Sum Rule, Factorial, Permutations, Combinations и Subsets. Отличаем число вариантов от размера ответа.', tasks: ['cf-1821-a', 'cf-1743-a', 'cf-629-a', 'cf-1674-b', 'number-of-good-pairs'] },
		{ number: 2, title: 'Backtracking: Subsets, Permutations, Combinations', summary: 'Backtracking: выбрать, пойти глубже, отменить. start задаёт возрастающие индексы, used отмечает занятые. Считаем вызовы, проверки, копии и память Call Stack.', tasks: ['letter-case-permutation', 'subsets', 'permutations', 'combinations', 'letter-combinations-of-a-phone-number'] },
		{ number: 3, title: 'Повторы и Pruning', summary: 'Sorting и пропуск убирают повторные ответы Backtracking. Pruning останавливает бесполезные ветки. Считаем вызовы, проверки, копии и память префиксов.', tasks: ['subsets-ii', 'permutations-ii', 'combination-sum', 'generate-parentheses', 'cf-1097-b'] },
		{ number: 4, title: 'Порядок и номер', summary: 'Next Permutation, Dynamic Programming для путей, Permutation Sequence и N-Queens. Учитываем копии Python, вызовы Factorial и формат ответа.', tasks: ['next-permutation', 'unique-paths', 'permutation-sequence', 'n-queens'] },
	]);
	const rows = details.chapters.flatMap(chapter => chapter.tasks);
	expect(rows.find(task => task.slug === 'subsets')).toEqual({ ...set.chapters[1].tasks.find(task => taskSlug(task) === 'subsets'), slug: 'subsets', label: 'LeetCode 78', problemId, accepted, assignable, activeTask: active ? { state: taskState } : null });
	expect(rows.filter(task => task.problemId || task.accepted || task.activeTask).map(task => task.slug)).toEqual(inLibrary ? ['subsets'] : []);
});

it.each([
	{ name: 'student chapter 1 lesson', role: 'student', item: set, chapter: '1', body: { html: set.chapters[0].lesson, figures: set.chapters[0].figures } },
	{ name: 'parent chapter 4 lesson', role: 'parent', item: set, chapter: '4', body: { html: set.chapters[3].lesson, figures: set.chapters[3].figures } },
	{ name: 'lesson with figures', role: 'student', item: twoPointers, chapter: '1', body: { html: twoPointers.chapters[0].lesson, figures: twoPointers.chapters[0].figures } },
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
	expect(item.topics).toEqual(normalizeTopics(item.topics));
	expect(tasks.filter(task => JSON.stringify(task.topics) !== JSON.stringify(normalizeTopics(task.topics, taskSlug(task)))).map(taskSlug)).toEqual([]);
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
	const lessons = item.chapters.map(chapter => chapter.lesson);
	expect(lessons.map(lesson => htmlText(lesson).length).filter(length => length >= 12000)).toEqual([]);
	expect(lessons.flatMap(lesson => [...lesson.matchAll(/<([a-z][a-z0-9]*)/gi)].map(match => match[1]).filter(tag => !fragmentTag.test(tag)))).toEqual([]);
	expect(lessons.flatMap((lesson, index) => lesson.startsWith('<p class="lead">') && !/\s(?:style|on[a-z]+)=|<div(?! class="rule">)/i.test(lesson) ? [] : [index + 1])).toEqual([]);
	// A figure is an empty placeholder on its own line. The placeholders follow the order of chapter.figures.
	expect(lessons.map(lesson => (lesson.match(/<figure\b/g) ?? []).length - (lesson.match(/^<figure data-figure="[a-z0-9-]+"><\/figure>$/gm) ?? []).length)).toEqual(lessons.map(() => 0));
	expect(lessons.map(lesson => [...lesson.matchAll(/data-figure="([^"]+)"/g)].map(match => match[1]))).toEqual(item.chapters.map(chapter => (chapter.figures ?? []).map(figure => figure.id)));
	const figures = item.chapters.flatMap(chapter => chapter.figures ?? []);
	expect(figures.filter(figure => !slugFormat.test(figure.id) || !figure.title.trim() || !figure.frames.length || figure.frames.some(frame => !frame.caption.trim() || !frame.rows.length || frame.rows.some(badRow))).map(figure => figure.id)).toEqual([]);
});

// The hard words that need a tip in shared/glossary.ts. The list also has words that no set uses yet, so a new set with such a word fails until the word gets a tip.
// An English name of a data structure is a word of its own: heapq, dequeue, collections.deque, deque(...) and deque.popleft are code.
const hardWord = /(?<!\p{L})(?:инвариант|O\(|log|метод|(?<![\d_.])(?:(?:heap|deque|queue|stack|array|string|subset|permutation|combination)s?|monotonic|priority|hash\s+table|two\s+pointers|linear\s+scan|binary\s+search|sliding\s+window|dynamic\s+programming|brute\s+force|backtracking|recursion|pruning|factorial|sorting|merge|greedy|simulation|quickselect|DFS|BFS)(?![\p{L}\d_(]|\.\p{L})|монотонн|жадн|моделир|кортеж|рекурс|перебор\p{L}*\s+с\s+возврат|отсеч|трассир|подмассив|подпоследовательн|лексикограф|ленив|индекс|факториал|перестановк|подмножеств|скользящ|ASCII|регистр|слияни|32-бит|линейн|переполн|амортиз|асимптот|мемоиз|итератор|компаратор|эвристик|коллизи|логарифм|граф|бинарн)/giu;
// The hard words of the text that no match of the patterns covers.
const untipped = (text: string, patterns: RegExp[]) => [...text.matchAll(hardWord)].filter(word => !patterns.some(pattern => [...text.matchAll(pattern)].some(match => match.index <= word.index && word.index < match.index + match[0].length))).map(word => word[0]);
// Code is not prose. The text of the other tags stays.
const prose = (html: string) => html.replace(/<(pre|code)\b[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, '');
it.each(sets.map(item => ({ name: item.slug, item })))('$name hard words have a tip', ({ item }) => {
	const patterns = glossary.map(entry => entry.pattern);
	const texts = [['summary', item.summary], ...item.chapters.flatMap((chapter, index) => [
		[`chapter ${index + 1} summary`, chapter.summary], [`chapter ${index + 1} lesson`, prose(chapter.lesson)],
		...chapter.tasks.flatMap(task => [[`${taskSlug(task)} statement`, prose(task.statement ?? '')], [`${taskSlug(task)} note`, task.note]]),
		...chapter.cards.flatMap(card => [[`${card.id} prompt`, card.prompt], [`${card.id} explain`, card.explain]]),
	])];
	expect(texts.flatMap(([place, text]) => untipped(text, patterns).map(word => `${place}: ${word}`))).toEqual([]);
});

// Technical names stay English. Ordinary Russian words such as a table row or a line of people remain valid.
const russianName = /(?<!\p{L})(?:куч(?:а|и|е|у|ей|ею|ам|ами|ах)?|дек(?:а|е|у|ом|и|ов|ам|ами|ах)?|стек(?:а|е|у|ом|и|ов|ам|ами|ах)?|массив\p{L}*|х[еэ]ш[- ]?таблиц\p{L}*|(?:двоичн|бинарн)\p{L}*\s+поиск\p{L}*|(?:два|двух|двумя)\s+указател\p{L}*|скользящ\p{L}*\s+окн\p{L}*|динамическ\p{L}*\s+программирован\p{L}*|сортировк\p{L}*|перестановк\p{L}*|подмножеств\p{L}*|подмассив\p{L}*|подпоследовательност\p{L}*|факториал\p{L}*)(?!\p{L})/giu;
const strings = (value: unknown): string[] => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.entries(value).filter(([key]) => key !== 'url').flatMap(([, item]) => strings(item)) : [];
it.each(sets.map(item => ({ name: item.slug, item })))('$name names the data structures in English', ({ item }) => {
	expect(strings(item).flatMap(text => text.match(russianName) ?? [])).toEqual([]);
});

it('each tip is plain', () => {
	expect(glossary.filter(entry => /[–—]/.test(entry.tip) || untipped(entry.tip, [entry.pattern]).length).map(entry => entry.tip)).toEqual([]);
});

it.each(sets.flatMap(tasksOf).map(task => ({ name: taskSlug(task), task })))('$name reference passes the standard tests', ({ task }) => {
	const content = contentOf(taskSlug(task))!, tests = content.task.tests!, reference = content.reference;
	expect(reference?.mode).toBe(tests.mode);
	expect(tests.cases.filter(item => { const answer = expectedOf(reference!, item.input); return !answer || !('value' in answer) || !same(tests, item.expected!, answer.value); })).toEqual([]);
});

// The hidden tests of seeds 1 and 2^32 - 1. Each input must have the argument count of the reference and satisfy the constraints. A reference run of 100 ms or more makes the judge route slow.
// The judge route refuses an output over 1,000,000 characters, so a longer answer can never pass.
it.each(sets.flatMap(tasksOf).map(task => ({ name: taskSlug(task), task })))('$name generator gives valid hidden tests', ({ task }) => {
	const content = contentOf(taskSlug(task))!, reference = content.reference!, generate = content.generate, inputs = generate?.(mulberry32(1)) ?? [];
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

const linkedSet = { slug: 'permutations-and-combinations', title: 'Permutations и Combinations' };
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

const chapter2 = { set: 'permutations-and-combinations', setTitle: 'Permutations и Combinations', number: 2, title: 'Backtracking: Subsets, Permutations, Combinations' };
const chapter3 = { ...chapter2, number: 3, title: 'Повторы и Pruning' };
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
	const content = contentOf('total-cost-to-hire-k-workers')!, reference = content.reference as Extract<Reference, { mode: 'call' }>, generate = content.generate!;
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
