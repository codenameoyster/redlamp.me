import type { Env } from '../index';
import type { Dashboard, Difficulty, SetTask } from '../../shared/leetcode';
import { problemUrl } from './problems';
import { sets, taskLabel, taskSlug, tasksOf } from './sets';

export const recallPools = [{ count: 3, set: 'two-pointers' }, { count: 2, slugs: ['sum-of-all-subset-xor-totals', 'letter-case-permutation', 'letter-combinations-of-a-phone-number'] }];

// 32-bit FNV-1a: https://www.rfc-editor.org/rfc/rfc9923.html#section-2
function fnv1a(value: string): number {
	let hash = 0x811c9dc5;
	for (const byte of new TextEncoder().encode(value)) hash = Math.imul(hash ^ byte, 0x01000193);
	return hash >>> 0;
}

type Row = { id: string; slug: string; number: number | null; title: string; difficulty: Difficulty; topics: string; summary: string; skip: number | null };
export async function recallPicks(env: Env, today: string): Promise<Dashboard['recallPicks']> {
	const setTasks = (slug: string) => tasksOf(sets.find(set => set.slug === slug)!);
	const slugs = recallPools.flatMap(pool => pool.slugs ?? setTasks(pool.set).map(taskSlug));
	const rows = await env.DB.prepare('SELECT p.id,p.slug,p.number,p.title,p.difficulty,p.topics,p.summary,(p.archived_at IS NOT NULL OR p.next_review_date<=? OR EXISTS(SELECT 1 FROM reviews r WHERE r.problem_id=p.id AND r.reviewed_on=?)) AS skip FROM problems p WHERE p.slug IN (SELECT value FROM json_each(?))').bind(today, today, JSON.stringify(slugs)).all<Row>();
	const library = new Map(rows.results.map(row => [row.slug, row]));
	return recallPools.flatMap(pool => (pool.slugs ? pool.slugs.flatMap((slug): SetTask[] => { const row = library.get(slug); return row ? [{ url: problemUrl(slug), number: row.number ?? undefined, title: row.title, difficulty: row.difficulty, topics: JSON.parse(row.topics), note: row.summary }] : []; }) : setTasks(pool.set))
		.map(task => ({ ...task, slug: taskSlug(task), label: taskLabel(task), problemId: library.get(taskSlug(task))?.id ?? null }))
		.filter(pick => !library.get(pick.slug)?.skip)
		.sort((a, b) => fnv1a(`${today}:${a.slug}`) - fnv1a(`${today}:${b.slug}`)).slice(0, pool.count));
}
