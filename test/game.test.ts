import { env } from 'cloudflare:workers';
import { beforeEach, expect, it } from 'vitest';
import { login, request } from './client';
import type { Acceptance, BadgeId, Difficulty, Role, TaskState, Understanding } from '../shared/leetcode';
import { sets } from '../src/leetcode/sets';

interface Spec { difficulty: Difficulty; slug?: string; archived?: boolean; attempts?: { state?: 'saved' | 'draft'; acceptance: Acceptance; understanding?: Understanding; savedAt?: string }[]; reviews?: { result: Understanding; on: string }[]; task?: TaskState }
const insertProblem = env.DB.prepare("INSERT INTO problems (id,slug,title,difficulty,topics,summary,search_text,archived_at,created_at,updated_at) VALUES (?,?,'Problem',?,'[]','','',?,'now','now')");
const insertAttempt = env.DB.prepare("INSERT INTO attempts (id,problem_id,state,document,search_text,acceptance,understanding,saved_at,created_at,updated_at) VALUES (?,?,?,'{}','',?,?,?,'now','now')");
const insertReview = env.DB.prepare("INSERT INTO reviews (id,problem_id,result,note,reviewed_on,created_at) VALUES (?,?,?,'',?,'now')");
const insertBundle = env.DB.prepare("INSERT INTO homework (id,title,instructions,created_at,updated_at) VALUES (?,'Week 41','','now','now')");
const insertTask = env.DB.prepare("INSERT INTO homework_tasks (id,homework_id,problem_id,state,created_at,updated_at) VALUES (?,?,?,?,'now','now')");
const accepted = (difficulty: Difficulty, understanding: Understanding = 'with_help'): Spec => ({ difficulty, attempts: [{ acceptance: 'accepted', understanding }] });
const setTasks = sets.find(set => set.slug === 'permutations-and-combinations')!.tasks;
const order: BadgeId[] = ['first-accept', 'three-day-streak', 'first-hard', 'ten-accepted', 'independent-five', 'set-cleared'];

let student: string;
beforeEach(async () => { student = await login(); });

it.each<{ name: string; role?: Role; problems: Spec[]; xp: number; level: number; levelXp: number; nextLevelXp: number; earned: BadgeId[] }>([
	{ name: 'empty notebook', problems: [], xp: 0, level: 1, levelXp: 0, nextLevelXp: 100, earned: [] },
	{ name: 'accepted easy', problems: [accepted('easy')], xp: 10, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'two accepted attempts count once', problems: [{ difficulty: 'easy', attempts: [{ acceptance: 'accepted' }, { acceptance: 'accepted' }] }], xp: 10, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'parent reads the same game', role: 'parent', problems: [accepted('easy')], xp: 10, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'accepted hard', problems: [accepted('hard')], xp: 40, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept', 'first-hard'] },
	{ name: 'saved but not accepted', problems: [{ difficulty: 'medium', attempts: [{ acceptance: 'not_accepted' }] }], xp: 0, level: 1, levelXp: 0, nextLevelXp: 100, earned: [] },
	{ name: 'accepted draft', problems: [{ difficulty: 'medium', attempts: [{ state: 'draft', acceptance: 'accepted' }] }], xp: 0, level: 1, levelXp: 0, nextLevelXp: 100, earned: [] },
	{ name: 'independent attempt', problems: [accepted('easy', 'independent')], xp: 20, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'independent recall after help', problems: [{ ...accepted('easy'), reviews: [{ result: 'independent', on: '2026-10-01' }] }], xp: 25, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'later needs-practice recall keeps bonus', problems: [{ ...accepted('easy', 'independent'), reviews: [{ result: 'needs_practice', on: '2026-10-02' }] }], xp: 25, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'independent attempt and independent recall count once', problems: [{ ...accepted('easy', 'independent'), reviews: [{ result: 'independent', on: '2026-10-01' }] }], xp: 25, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'two recalls on one day', problems: [{ ...accepted('easy'), reviews: [{ result: 'with_help', on: '2026-10-01' }, { result: 'needs_practice', on: '2026-10-01' }] }], xp: 15, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'recalls of two problems on one day', problems: [{ ...accepted('easy'), reviews: [{ result: 'with_help', on: '2026-10-01' }] }, { ...accepted('easy'), reviews: [{ result: 'with_help', on: '2026-10-01' }] }], xp: 30, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'completed task', problems: [{ difficulty: 'medium', task: 'completed' }], xp: 15, level: 1, levelXp: 0, nextLevelXp: 100, earned: [] },
	{ name: 'cancelled task', problems: [{ difficulty: 'medium', task: 'cancelled' }], xp: 0, level: 1, levelXp: 0, nextLevelXp: 100, earned: [] },
	{ name: 'archived accepted problem', problems: [{ ...accepted('easy'), archived: true }], xp: 10, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: '95 XP stays level 1', problems: [accepted('medium'), accepted('medium'), accepted('medium'), { ...accepted('medium'), reviews: [{ result: 'with_help', on: '2026-10-01' }, { result: 'with_help', on: '2026-10-02' }, { result: 'needs_practice', on: '2026-10-03' }] }], xp: 95, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'exactly 100 XP is level 2', problems: Array<Spec>(5).fill(accepted('medium')), xp: 100, level: 2, levelXp: 100, nextLevelXp: 300, earned: ['first-accept'] },
	{ name: 'ten accepted', problems: Array<Spec>(10).fill(accepted('easy')), xp: 100, level: 2, levelXp: 100, nextLevelXp: 300, earned: ['first-accept', 'ten-accepted'] },
	{ name: 'five independent', problems: Array<Spec>(5).fill(accepted('easy', 'independent')), xp: 100, level: 2, levelXp: 100, nextLevelXp: 300, earned: ['first-accept', 'independent-five'] },
	{ name: 'three save days in a row', problems: [{ difficulty: 'medium', attempts: [{ acceptance: 'not_accepted', savedAt: '2026-10-01T23:59:00.000Z' }, { acceptance: 'not_accepted', savedAt: '2026-10-02T00:01:00.000Z' }, { acceptance: 'not_accepted', savedAt: '2026-10-03T12:00:00.000Z' }] }], xp: 0, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['three-day-streak'] },
	{ name: 'gap day', problems: [{ difficulty: 'medium', attempts: [{ acceptance: 'not_accepted', savedAt: '2026-10-01T12:00:00.000Z' }, { acceptance: 'not_accepted', savedAt: '2026-10-02T12:00:00.000Z' }, { acceptance: 'not_accepted', savedAt: '2026-10-04T12:00:00.000Z' }] }], xp: 0, level: 1, levelXp: 0, nextLevelXp: 100, earned: [] },
	{ name: 'set cleared', problems: setTasks.map(task => ({ ...accepted(task.difficulty), slug: task.slug })), xp: 350, level: 3, levelXp: 300, nextLevelXp: 600, earned: ['first-accept', 'first-hard', 'ten-accepted', 'set-cleared'] },
	{ name: 'set one short', problems: setTasks.filter(task => task.slug !== 'next-permutation').map(task => ({ ...accepted(task.difficulty), slug: task.slug })), xp: 330, level: 3, levelXp: 300, nextLevelXp: 600, earned: ['first-accept', 'first-hard', 'ten-accepted'] },
])('$name', async ({ role, problems, xp, level, levelXp, nextLevelXp, earned }) => {
	const statements = problems.flatMap(problem => {
		const id = crypto.randomUUID(), homeworkId = crypto.randomUUID();
		return [
			insertProblem.bind(id, problem.slug ?? id, problem.difficulty, problem.archived ? 'now' : null),
			...(problem.attempts ?? []).map(attempt => insertAttempt.bind(crypto.randomUUID(), id, attempt.state ?? 'saved', attempt.acceptance, attempt.understanding ?? 'with_help', attempt.savedAt ?? null)),
			...(problem.reviews ?? []).map(review => insertReview.bind(crypto.randomUUID(), id, review.result, review.on)),
			...(problem.task ? [insertBundle.bind(homeworkId), insertTask.bind(crypto.randomUUID(), homeworkId, id, problem.task)] : []),
		];
	});
	if (statements.length) await env.DB.batch(statements);
	const response = await request('/game', 'GET', undefined, role ? await login(role) : student);
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ xp, level, levelXp, nextLevelXp, badges: order.map(id => ({ id, earned: earned.includes(id) })) });
});
