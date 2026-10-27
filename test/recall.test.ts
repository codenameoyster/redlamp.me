import { env } from 'cloudflare:workers';
import { expect, it } from 'vitest';
import { recallPicks } from '../src/leetcode/recall';
import { sets, taskLabel, taskSlug, tasksOf } from '../src/leetcode/sets';

type Library = { slug: string; due?: string; reviewedOn?: string; archived?: boolean }[];
const insertProblem = env.DB.prepare("INSERT INTO problems (id,slug,title,difficulty,topics,summary,search_text,next_review_date,archived_at,created_at,updated_at) VALUES (?,?,'Problem','medium','[]','','',?,?,'now','now')");
const insertReview = env.DB.prepare("INSERT INTO reviews (id,problem_id,result,note,reviewed_on,created_at) VALUES (?,?,'with_help','',?,'now')");
const tasks = new Map(tasksOf(sets.find(set => set.slug === 'two-pointers')!).map(task => [taskSlug(task), task]));
// All set tasks except the first three are due in the manual list, so the set pool has exactly three candidates.
const kept = [...tasks.keys()].slice(0, 3), due = [...tasks.keys()].slice(3).map(slug => ({ slug, due: '2026-10-11' }));
const [xor, letterCase, phone] = ['sum-of-all-subset-xor-totals', 'letter-case-permutation', 'letter-combinations-of-a-phone-number'];
const setTopics: Record<string, string[]> = { 'two-sum-ii-input-array-is-sorted': ['Array', 'Two Pointers'], 'valid-palindrome': ['String', 'Two Pointers'], 'max-number-of-k-sum-pairs': ['Array', 'Two Pointers', 'Sorting'] };
async function addLibrary(library: Library) {
	const ids = new Map<string, string>();
	for (const problem of library) {
		const id = crypto.randomUUID(); ids.set(problem.slug, id);
		await insertProblem.bind(id, problem.slug, problem.due ?? null, problem.archived ? 'now' : null).run();
		if (problem.reviewedOn) await insertReview.bind(crypto.randomUUID(), id, problem.reviewedOn).run();
	}
	return ids;
}

it.each<{ name: string; library: Library; picks: string[] }>([
	{ name: 'set tasks without a library row', library: due, picks: kept },
	{ name: 'set tasks with a library row', library: [...kept.map(slug => ({ slug })), ...due], picks: kept },
	{ name: 'homework slugs outside the library are skipped', library: [...due, { slug: xor }], picks: [...kept, xor] },
	{ name: 'homework problem due today leaves the pool', library: [...due, { slug: xor }, { slug: letterCase }, { slug: phone, due: '2026-10-11' }], picks: [...kept, xor, letterCase] },
	{ name: 'overdue homework problem leaves the pool', library: [...due, { slug: xor }, { slug: letterCase }, { slug: phone, due: '2026-10-01' }], picks: [...kept, xor, letterCase] },
	{ name: 'homework problem due tomorrow stays in the pool', library: [...due, { slug: xor }, { slug: phone, due: '2026-10-12' }], picks: [...kept, xor, phone] },
	{ name: 'homework problem reviewed today leaves the pool', library: [...due, { slug: xor }, { slug: letterCase }, { slug: phone, reviewedOn: '2026-10-11' }], picks: [...kept, xor, letterCase] },
	{ name: 'homework problem reviewed yesterday stays in the pool', library: [...due, { slug: xor }, { slug: phone, reviewedOn: '2026-10-10' }], picks: [...kept, xor, phone] },
	{ name: 'archived homework problem leaves the pool', library: [...due, { slug: xor }, { slug: letterCase }, { slug: phone, archived: true }], picks: [...kept, xor, letterCase] },
])('$name', async ({ library, picks }) => {
	const ids = await addLibrary(library);
	const expected = picks.map(slug => {
		const task = tasks.get(slug);
		return task ? { ...task, topics: setTopics[slug], slug, label: taskLabel(task), problemId: ids.get(slug) ?? null } : { url: `https://leetcode.com/problems/${slug}/`, title: 'Problem', difficulty: 'medium', topics: [], note: '', slug, label: 'LeetCode', problemId: ids.get(slug) };
	});
	const bySlug = (a: { slug: string }, b: { slug: string }) => a.slug.localeCompare(b.slug);
	expect([...await recallPicks(env, '2026-10-11')].sort(bySlug)).toEqual(expected.sort(bySlug));
});

it.each([
	{ name: 'library aliases', slug: xor, topics: ['HashTable', 'Хеш-таблица', 'Hash Table'], expected: ['Hash Table'] },
	{ name: 'contextual library topics', slug: letterCase, topics: ['Строка', 'Перебор', 'Backtracking'], expected: ['String', 'Backtracking'] },
	{ name: 'unknown legacy topic', slug: phone, topics: ['Особая тема'], expected: ['Особая тема'] },
])('normalizes recall topics for $name', async ({ slug, topics, expected }) => {
	const ids = await addLibrary([...due, { slug }]);
	await env.DB.prepare("UPDATE problems SET topics=?,summary='Мои заметки',progress_version=9,understanding='with_help' WHERE slug=?").bind(JSON.stringify(topics), slug).run();
	const before = await env.DB.prepare('SELECT * FROM problems WHERE slug=?').bind(slug).first();
	const pick = (await recallPicks(env, '2026-10-11')).find(pick => pick.slug === slug);
	expect(pick).toMatchObject({ problemId: ids.get(slug), slug, topics: expected, note: 'Мои заметки' });
	expect(await env.DB.prepare('SELECT * FROM problems WHERE slug=?').bind(slug).first()).toEqual(before);
});

it.each([
	{ name: 'same day gives the same picks', other: '2026-10-11', same: true },
	{ name: 'next day gives new picks', other: '2026-10-12', same: false },
])('$name', async ({ other, same }) => {
	await addLibrary([{ slug: xor }, { slug: letterCase }, { slug: phone }]);
	const slugs = async (today: string) => String((await recallPicks(env, today)).map(pick => pick.slug).sort());
	expect((await recallPicks(env, '2026-10-11'))).toHaveLength(5);
	expect(await slugs(other) === await slugs('2026-10-11')).toBe(same);
});
