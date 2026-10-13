import { env } from 'cloudflare:workers';
import { beforeEach, expect, it } from 'vitest';
import { login, request } from './client';
import type { Acceptance, BadgeId, Difficulty, Role, TaskState, Understanding } from '../shared/leetcode';
import { sets, taskSlug, tasksOf } from '../src/leetcode/sets';

interface Spec { difficulty: Difficulty; slug?: string; archived?: boolean; attempts?: { state?: 'saved' | 'draft'; acceptance: Acceptance; understanding?: Understanding; savedAt?: string }[]; reviews?: { result: Understanding; on: string }[]; task?: TaskState; due?: string; submitted?: string; added?: string; postpone?: boolean; runs?: { passed: number; total: number; on: string }[] }
const insertProblem = env.DB.prepare("INSERT INTO problems (id,slug,title,difficulty,topics,summary,search_text,archived_at,created_at,updated_at) VALUES (?,?,'Problem',?,'[]','','',?,'now','now')");
const insertAttempt = env.DB.prepare("INSERT INTO attempts (id,problem_id,state,document,search_text,acceptance,understanding,saved_at,created_at,updated_at) VALUES (?,?,?,'{}','',?,?,?,'now','now')");
const insertReview = env.DB.prepare("INSERT INTO reviews (id,problem_id,result,note,reviewed_on,created_at) VALUES (?,?,?,'',?,'now')");
const insertBundle = env.DB.prepare("INSERT INTO homework (id,title,instructions,due_date,created_at,updated_at) VALUES (?,'Week 41','',?,'now','now')");
const insertTask = env.DB.prepare("INSERT INTO homework_tasks (id,homework_id,problem_id,state,created_at,updated_at) VALUES (?,?,?,?,?,'now')");
// Сила Бомжа moves the due date by one day.
const postpone = env.DB.prepare("UPDATE homework SET due_date=date(due_date,'+1 day') WHERE id=?");
const insertCard = env.DB.prepare("INSERT INTO card_answers VALUES (?,'pc1-factorial',?,3,?,?,'now')");
const insertSubmission = env.DB.prepare('INSERT INTO submissions (id,task_id,attempt_id,task_version,created_at) VALUES (?,?,?,1,?)');
const insertRun = env.DB.prepare("INSERT INTO test_runs (id,problem_id,attempt_id,approach_id,code_hash,passed,total,run_on,created_at) VALUES (?,?,?,'approach','hash',?,?,?,?)");
const insertVisit = env.DB.prepare('INSERT INTO visits (day) VALUES (?)');
const run = (passed: number, on: string) => ({ passed, total: 5, on });
const accepted = (difficulty: Difficulty, understanding: Understanding = 'with_help'): Spec => ({ difficulty, attempts: [{ acceptance: 'accepted', understanding }] });
const setTasks = tasksOf(sets.find(set => set.slug === 'permutations-and-combinations')!), twoSetTasks = sets.filter(set => ['permutations-and-combinations', 'two-pointers'].includes(set.slug)).flatMap(tasksOf);
const today = new Date().toISOString().slice(0, 10);
// A UTC date offset days from today, and a run of consecutive day offsets.
const day = (offset: number) => new Date(Date.parse(today) + offset * 86_400_000).toISOString().slice(0, 10);
const days = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const cardDays = (count: number, correct = true) => Array.from({ length: count }, (_, i) => ({ correct, on: new Date(Date.parse('2026-01-01') + i * 86_400_000).toISOString().slice(0, 10) }));
const recalls = (count: number) => Array.from({ length: count }, (_, i) => ({ result: 'with_help' as const, on: `2026-09-${String(i + 1).padStart(2, '0')}` }));
const onTime = (late = false): Spec => ({ difficulty: 'medium', task: 'submitted', due: '2026-10-01', submitted: late ? '2026-10-02T12:00:00.000Z' : '2026-10-01T12:00:00.000Z' });
const order: BadgeId[] = ['first-accept', 'three-day-streak', 'first-hard', 'ten-accepted', 'independent-five', 'set-cleared', 'week-no-miss', 'month-no-miss', 'twenty-five-accepted', 'fifty-accepted', 'fifty-cards', 'ten-recalls', 'first-codeforces', 'first-try', 'two-sets', 'on-time-five', 'level-five'];

let student: string;
beforeEach(async () => { student = await login(); });

it.each<{ name: string; role?: Role; problems: Spec[]; cards?: { correct: boolean; on: string }[]; visits?: number[]; xp: number; late?: number; missed?: number; level: number; levelXp: number; nextLevelXp: number; earned: BadgeId[] }>([
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
	{ name: 'set cleared', problems: setTasks.map(task => ({ ...accepted(task.difficulty), slug: taskSlug(task) })), xp: 370, level: 3, levelXp: 300, nextLevelXp: 600, earned: ['first-accept', 'first-hard', 'ten-accepted', 'set-cleared', 'first-codeforces'] },
	{ name: 'set one short', problems: setTasks.filter(task => taskSlug(task) !== 'next-permutation').map(task => ({ ...accepted(task.difficulty), slug: taskSlug(task) })), xp: 350, level: 3, levelXp: 300, nextLevelXp: 600, earned: ['first-accept', 'first-hard', 'ten-accepted', 'first-codeforces'] },
	{ name: 'correct card', problems: [], cards: [{ correct: true, on: '2026-10-01' }], xp: 2, level: 1, levelXp: 0, nextLevelXp: 100, earned: [] },
	{ name: 'wrong card', problems: [], cards: [{ correct: false, on: '2026-10-01' }], xp: 0, level: 1, levelXp: 0, nextLevelXp: 100, earned: [] },
	{ name: 'same card on two days', problems: [], cards: [{ correct: true, on: '2026-10-01' }, { correct: true, on: '2026-10-02' }], xp: 4, level: 1, levelXp: 0, nextLevelXp: 100, earned: [] },
	{ name: 'first test pass', problems: [{ difficulty: 'easy', runs: [run(5, '2026-10-01')] }], xp: 10, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-try'] },
	{ name: 'second test pass on the same problem', problems: [{ difficulty: 'easy', runs: [run(5, '2026-10-01'), run(5, '2026-10-02')] }], xp: 10, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-try'] },
	{ name: 'test pass after a failed first run', problems: [{ difficulty: 'easy', runs: [run(4, '2026-10-01'), run(5, '2026-10-02')] }], xp: 8, level: 1, levelXp: 0, nextLevelXp: 100, earned: [] },
	{ name: 'test pass after a failed run on the same day', problems: [{ difficulty: 'easy', runs: [run(4, '2026-10-01'), run(5, '2026-10-01')] }], xp: 8, level: 1, levelXp: 0, nextLevelXp: 100, earned: [] },
	{ name: 'test run without a check', problems: [{ ...accepted('medium'), runs: [{ passed: 0, total: 0, on: '2026-10-01' }] }], xp: 20, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'three failed runs on one day', problems: [{ ...accepted('medium'), runs: Array(3).fill(run(4, '2026-10-01')) }], xp: 14, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'four failed runs on one day', problems: [{ ...accepted('medium'), runs: Array(4).fill(run(4, '2026-10-01')) }], xp: 14, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'failed runs on two days', problems: [{ ...accepted('medium'), runs: [...Array(3).fill(run(4, '2026-10-01')), ...Array(3).fill(run(4, '2026-10-02'))] }], xp: 8, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'failed runs of two problems on one day', problems: Array<Spec>(2).fill({ ...accepted('medium'), runs: Array(3).fill(run(4, '2026-10-01')) }), xp: 28, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'submitted on the due date', problems: [{ ...accepted('medium'), task: 'submitted', due: '2026-10-01', submitted: '2026-10-01T23:59:00.000Z' }], xp: 20, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'submitted the day after the due date', problems: [{ ...accepted('medium'), task: 'submitted', due: '2026-10-01', submitted: '2026-10-02T00:01:00.000Z' }], xp: 5, late: 1, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'not submitted and overdue', problems: [{ ...accepted('medium'), task: 'assigned', due: '2026-10-01' }], xp: 5, late: 1, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'not submitted and due today', problems: [{ ...accepted('medium'), task: 'assigned', due: today }], xp: 20, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'cancelled and overdue', problems: [{ ...accepted('medium'), task: 'cancelled', due: '2026-10-01' }], xp: 20, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'postponed and submitted on the new date', problems: [{ ...accepted('medium'), task: 'submitted', due: '2026-10-01', postpone: true, submitted: '2026-10-02T12:00:00.000Z' }], xp: 20, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'added after the due date and not submitted', problems: [{ ...accepted('medium'), task: 'assigned', due: '2026-10-01', added: '2026-10-02T09:00:00.000Z' }], xp: 20, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'added on the due date and not submitted', problems: [{ ...accepted('medium'), task: 'assigned', due: '2026-10-01', added: '2026-10-01T09:00:00.000Z' }], xp: 5, late: 1, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'late penalty below 0 XP', problems: [{ ...accepted('easy'), task: 'assigned', due: '2026-10-01' }], xp: 0, late: 1, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'visit only today', problems: [], visits: [0], xp: 0, level: 1, levelXp: 0, nextLevelXp: 100, earned: [] },
	{ name: 'two missed days', problems: [accepted('medium')], visits: [-3, 0], xp: 10, missed: 2, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'yesterday missed before the visit of today', problems: [accepted('medium')], visits: [-2], xp: 15, missed: 1, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'missed days below 0 XP', problems: [accepted('easy')], visits: [-10, 0], xp: 0, missed: 9, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'six visit days in a row', problems: [], visits: days(-5, 0), xp: 0, level: 1, levelXp: 0, nextLevelXp: 100, earned: [] },
	{ name: 'seven visit days in a row', problems: [], visits: days(-6, 0), xp: 0, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['week-no-miss'] },
	{ name: 'seven visit days with a gap', problems: [], visits: [...days(-7, -4), ...days(-2, 0)], xp: 0, missed: 1, level: 1, levelXp: 0, nextLevelXp: 100, earned: [] },
	{ name: 'seven visit days that ended before', problems: [accepted('medium')], visits: [...days(-9, -3), 0], xp: 10, missed: 2, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept', 'week-no-miss'] },
	{ name: 'twenty-nine visit days in a row', problems: [], visits: days(-28, 0), xp: 0, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['week-no-miss'] },
	{ name: 'thirty visit days in a row', problems: [], visits: days(-29, 0), xp: 0, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['week-no-miss', 'month-no-miss'] },
	{ name: '24 accepted', problems: Array<Spec>(24).fill(accepted('easy')), xp: 240, level: 2, levelXp: 100, nextLevelXp: 300, earned: ['first-accept', 'ten-accepted'] },
	{ name: '25 accepted', problems: Array<Spec>(25).fill(accepted('easy')), xp: 250, level: 2, levelXp: 100, nextLevelXp: 300, earned: ['first-accept', 'ten-accepted', 'twenty-five-accepted'] },
	{ name: '49 accepted', problems: Array<Spec>(49).fill(accepted('easy')), xp: 490, level: 3, levelXp: 300, nextLevelXp: 600, earned: ['first-accept', 'ten-accepted', 'twenty-five-accepted'] },
	{ name: '50 accepted', problems: Array<Spec>(50).fill(accepted('easy')), xp: 500, level: 3, levelXp: 300, nextLevelXp: 600, earned: ['first-accept', 'ten-accepted', 'twenty-five-accepted', 'fifty-accepted'] },
	{ name: '49 correct cards', problems: [], cards: cardDays(49), xp: 98, level: 1, levelXp: 0, nextLevelXp: 100, earned: [] },
	{ name: '50 correct cards', problems: [], cards: cardDays(50), xp: 100, level: 2, levelXp: 100, nextLevelXp: 300, earned: ['fifty-cards'] },
	{ name: '50 cards with one wrong', problems: [], cards: [...cardDays(49), { correct: false, on: '2026-06-01' }], xp: 98, level: 1, levelXp: 0, nextLevelXp: 100, earned: [] },
	{ name: 'nine recalls', problems: [{ ...accepted('easy'), reviews: recalls(9) }], xp: 55, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
	{ name: 'ten recalls', problems: [{ ...accepted('easy'), reviews: recalls(10) }], xp: 60, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept', 'ten-recalls'] },
	{ name: 'accepted Codeforces problem', problems: [{ ...accepted('medium'), slug: 'cf-1538-c' }], xp: 20, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept', 'first-codeforces'] },
	{ name: 'Codeforces problem not accepted', problems: [{ difficulty: 'medium', slug: 'cf-1538-c', attempts: [{ acceptance: 'not_accepted' }] }], xp: 0, level: 1, levelXp: 0, nextLevelXp: 100, earned: [] },
	{ name: 'two sets cleared', problems: twoSetTasks.map(task => ({ ...accepted(task.difficulty), slug: taskSlug(task) })), xp: 630, level: 4, levelXp: 600, nextLevelXp: 1000, earned: ['first-accept', 'first-hard', 'ten-accepted', 'set-cleared', 'twenty-five-accepted', 'two-sets', 'first-codeforces'] },
	{ name: 'four tasks on time', problems: Array<Spec>(4).fill(onTime()), xp: 0, level: 1, levelXp: 0, nextLevelXp: 100, earned: [] },
	{ name: 'five tasks on time', problems: Array<Spec>(5).fill(onTime()), xp: 0, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['on-time-five'] },
	{ name: 'four on time and one late', problems: [...Array<Spec>(4).fill(onTime()), onTime(true)], xp: 0, late: 1, level: 1, levelXp: 0, nextLevelXp: 100, earned: [] },
	{ name: 'level 4 at 960 XP', problems: Array<Spec>(24).fill(accepted('hard')), xp: 960, level: 4, levelXp: 600, nextLevelXp: 1000, earned: ['first-accept', 'first-hard', 'ten-accepted'] },
	{ name: 'level 5 at 1000 XP', problems: Array<Spec>(25).fill(accepted('hard')), xp: 1000, level: 5, levelXp: 1000, nextLevelXp: 1500, earned: ['first-accept', 'first-hard', 'ten-accepted', 'twenty-five-accepted', 'level-five'] },
	{ name: 'failed runs below 0 XP', problems: [{ ...accepted('easy'), runs: [...Array(3).fill(run(0, '2026-10-01')), ...Array(3).fill(run(0, '2026-10-02'))] }], xp: 0, level: 1, levelXp: 0, nextLevelXp: 100, earned: ['first-accept'] },
])('$name', async ({ role, problems, cards = [], visits = [], xp, late = 0, missed = 0, level, levelXp, nextLevelXp, earned }) => {
	const statements = problems.flatMap(problem => {
		const id = crypto.randomUUID(), homeworkId = crypto.randomUUID(), taskId = crypto.randomUUID(), attemptId = crypto.randomUUID();
		return [
			insertProblem.bind(id, problem.slug ?? id, problem.difficulty, problem.archived ? 'now' : null),
			...(problem.attempts ?? []).map(attempt => insertAttempt.bind(crypto.randomUUID(), id, attempt.state ?? 'saved', attempt.acceptance, attempt.understanding ?? 'with_help', attempt.savedAt ?? null)),
			...(problem.reviews ?? []).map(review => insertReview.bind(crypto.randomUUID(), id, review.result, review.on)),
			...(problem.task ? [insertBundle.bind(homeworkId, problem.due ?? null), insertTask.bind(taskId, homeworkId, id, problem.task, problem.added ?? '2026-09-01T00:00:00.000Z')] : []),
			...(problem.postpone ? [postpone.bind(homeworkId)] : []),
			...(problem.runs || problem.submitted ? [insertAttempt.bind(attemptId, id, 'draft', 'not_submitted', 'needs_practice', null)] : []),
			// The list order is the time order of the runs.
			...(problem.runs ?? []).map((run, i) => insertRun.bind(crypto.randomUUID(), id, attemptId, run.passed, run.total, run.on, `${run.on}T12:00:00.${String(i).padStart(3, '0')}Z`)),
			...(problem.submitted ? [insertSubmission.bind(crypto.randomUUID(), taskId, attemptId, problem.submitted)] : []),
		];
	}).concat(cards.map(card => insertCard.bind(crypto.randomUUID(), Number(card.correct), card.on, card.on)), visits.map(offset => insertVisit.bind(day(offset))));
	if (statements.length) await env.DB.batch(statements);
	const response = await request('/game', 'GET', undefined, role ? await login(role) : student);
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ xp, level, levelXp, nextLevelXp, late, missed, badges: order.map(id => ({ id, earned: earned.includes(id) })) });
});

// The layout reads the game on each page change, also without a reload, so a tab that stays open overnight records the new day.
it.each([
	{ name: 'the student game records the day', role: 'student' as Role, days: [today] },
	{ name: 'the parent game records nothing', role: 'parent' as Role, days: [] },
])('$name', async ({ role, days }) => {
	const cookie = await login(role);
	for (let i = 0; i < 2; i++) expect((await request('/game', 'GET', undefined, cookie)).status).toBe(200);
	expect((await env.DB.prepare('SELECT day FROM visits').all<{ day: string }>()).results.map(row => row.day)).toEqual(days);
});
