import type { Env } from '../index';
import type { Dashboard, Difficulty } from '../../shared/leetcode';
import { problemUrl } from './problems';
import { taskLabel, taskSlug, tasksOf } from './sets';
import twoPointers from './sets/two-pointers/set';

// Only library problems are picks, because recall needs a problem that the student knows.
export const recallPools = [{ count: 3, slugs: tasksOf(twoPointers).map(taskSlug) }, { count: 2, slugs: ['sum-of-all-subset-xor-totals', 'letter-case-permutation', 'letter-combinations-of-a-phone-number'] }];

// 32-bit FNV-1a: https://www.rfc-editor.org/rfc/rfc9923.html#section-2
function fnv1a(value: string): number {
	let hash = 0x811c9dc5;
	for (const byte of new TextEncoder().encode(value)) hash = Math.imul(hash ^ byte, 0x01000193);
	return hash >>> 0;
}

type Row = { id: string; slug: string; number: number | null; title: string; difficulty: Difficulty; topics: string; summary: string; skip: number | null };
export async function recallPicks(env: Env, today: string): Promise<Dashboard['recallPicks']> {
	const rows = await env.DB.prepare('SELECT p.id,p.slug,p.number,p.title,p.difficulty,p.topics,p.summary,(p.archived_at IS NOT NULL OR p.next_review_date<=? OR EXISTS(SELECT 1 FROM reviews r WHERE r.problem_id=p.id AND r.reviewed_on=?)) AS skip FROM problems p WHERE p.slug IN (SELECT value FROM json_each(?))').bind(today, today, JSON.stringify(recallPools.flatMap(pool => pool.slugs))).all<Row>();
	const library = new Map(rows.results.map(row => [row.slug, row]));
	return recallPools.flatMap(pool => pool.slugs.flatMap(slug => {
		const row = library.get(slug);
		if (!row || row.skip) return [];
		const task = { url: problemUrl(slug), number: row.number ?? undefined, title: row.title, difficulty: row.difficulty, topics: JSON.parse(row.topics) as string[], note: row.summary };
		return [{ ...task, slug, label: taskLabel(task), problemId: row.id }];
	})
		.sort((a, b) => fnv1a(`${today}:${a.slug}`) - fnv1a(`${today}:${b.slug}`)).slice(0, pool.count));
}
