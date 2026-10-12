import type { Env } from '../index';
import type { BadgeId, Dashboard, Distribution, Game, HomeworkTask, Revision, SessionUser } from '../../shared/leetcode';
import { addCalendarDays } from '../../shared/dates';
import { requireRole } from './auth';
import { attemptColumns } from './attempts';
import { taskColumns, taskTables, unreadValue } from './homework';
import { getProblem, problemColumns, problemValue, solvedSQL } from './problems';
import { acceptedSetSlugs, sets, taskSlug, tasksOf } from './sets';
import { cardIds, dueCardsSQL } from './quiz';
import { recallPicks } from './recall';
import { calendarDate, changed, choice, integer, methods, object, page, pagination, readJson, text, uuid } from './http';

const reviewColumns = 'id,problem_id AS problemId,result,note,reviewed_on AS reviewedOn,next_review_date AS nextReviewDate,created_at AS createdAt';

// The window is [today + 1, today + 30]. A date in the window stays. Each other problem gets a random day of the least used days.
export function spreadDays(today: string, problems: { id: string; nextReviewDate: string | null }[], random: (count: number) => number): Record<string, string> {
	const uses = new Map(Array.from({ length: 30 }, (_, i) => [addCalendarDays(today, i + 1), 0]));
	for (const { nextReviewDate: day } of problems) if (day && uses.has(day)) uses.set(day, uses.get(day)! + 1);
	return Object.fromEntries(problems.filter(p => !uses.has(p.nextReviewDate ?? '')).map(p => {
		const least = Math.min(...uses.values()), free = [...uses.keys()].filter(day => uses.get(day) === least), day = free[random(free.length)];
		uses.set(day, least + 1);
		return [p.id, day];
	}));
}

export async function handleReviews(request: Request, env: Env, user: SessionUser): Promise<Response | null> {
	const url = new URL(request.url);
	if (url.pathname === '/leetcode/api/dashboard') {
		methods(request, ['GET']);
		const today = calendarDate(text(url.searchParams.get('today'), 10, true));
		const [[progress, assignments, topics, homework, drafts, dueReviews, dueCards], picks] = await Promise.all([env.DB.batch<Record<string, unknown>>([
			env.DB.prepare(`SELECT count(*) AS recorded,coalesce(sum(${solvedSQL}),0) AS solved,coalesce(sum(${solvedSQL} AND p.understanding='independent'),0) AS independent,coalesce(sum(p.next_review_date<=?),0) AS dueReviews FROM problems p WHERE p.archived_at IS NULL`).bind(today),
			env.DB.prepare("SELECT count(*) AS waitingReview FROM homework_tasks t JOIN problems p ON p.id=t.problem_id WHERE t.state='submitted' AND p.archived_at IS NULL"),
			env.DB.prepare(`SELECT t.value AS topic,count(*) AS solved,sum(p.understanding='independent') AS independent FROM problems p,json_each(p.topics) t WHERE p.archived_at IS NULL AND ${solvedSQL} GROUP BY t.value ORDER BY t.value LIMIT 50`),
			env.DB.prepare(`SELECT ${taskColumns} FROM ${taskTables} WHERE p.archived_at IS NULL AND t.state NOT IN ('completed','cancelled') ORDER BY ${user.role === 'parent' ? "(t.state='submitted') DESC,t.updated_at ASC" : "(t.state='submitted') ASC,h.due_date IS NULL,h.due_date ASC"},t.id LIMIT 10`).bind(user.role),
			env.DB.prepare(`SELECT ${attemptColumns},(SELECT title FROM problems p WHERE p.id=attempts.problem_id) AS problemTitle FROM attempts WHERE state='draft' AND EXISTS(SELECT 1 FROM problems p WHERE p.id=attempts.problem_id AND p.archived_at IS NULL) ORDER BY updated_at DESC,id LIMIT 5`),
			env.DB.prepare(`SELECT ${problemColumns},EXISTS(SELECT 1 FROM homework_tasks t WHERE t.problem_id=p.id AND t.state='completed') AS fromHomework FROM problems p WHERE p.archived_at IS NULL AND p.next_review_date<=? ORDER BY p.next_review_date,p.id LIMIT 10`).bind(today),
			env.DB.prepare(dueCardsSQL).bind(cardIds, today),
		]), recallPicks(env, today!)]);
		return Response.json({ counts: { ...progress.results[0], ...assignments.results[0], ...dueCards.results[0] }, topics: topics.results, homework: (homework.results as unknown as HomeworkTask[]).map(unreadValue), drafts: drafts.results, dueReviews: dueReviews.results.map(row => ({ ...problemValue(row as unknown as Parameters<typeof problemValue>[0]), fromHomework: Boolean(row.fromHomework) })), recallPicks: picks } as Dashboard);
	}
	if (url.pathname === '/leetcode/api/reviews/distribute') {
		methods(request, ['POST']);
		const today = calendarDate(text(object(await readJson(request), ['today']).today, 10, true))!;
		const rows = await env.DB.prepare("SELECT id,next_review_date AS nextReviewDate FROM problems p WHERE archived_at IS NULL AND EXISTS(SELECT 1 FROM homework_tasks t WHERE t.problem_id=p.id AND t.state='completed')").all<{ id: string; nextReviewDate: string | null }>();
		const days = spreadDays(today, rows.results, count => crypto.getRandomValues(new Uint32Array(1))[0] % count), dates = Object.values(days).sort();
		if (dates.length) await env.DB.prepare('UPDATE problems SET next_review_date=d.value,progress_version=progress_version+1,updated_at=? FROM json_each(?) d WHERE problems.id=d.key').bind(new Date().toISOString(), JSON.stringify(days)).run();
		return Response.json({ count: dates.length, from: dates[0] ?? null, to: dates.at(-1) ?? null } satisfies Distribution);
	}
	if (url.pathname === '/leetcode/api/game') {
		methods(request, ['GET']);
		// A task is late after its due date in UTC. East of UTC, this gives the student a few more hours.
		const [[totals, streak], accepted] = await Promise.all([env.DB.batch<Record<string, number>>([
			env.DB.prepare(`SELECT count(*) AS accepted,coalesce(sum(p.difficulty='hard'),0) AS hard,coalesce(sum(CASE p.difficulty WHEN 'easy' THEN 10 WHEN 'medium' THEN 20 ELSE 40 END),0) AS acceptedXp,
				coalesce(sum(EXISTS(SELECT 1 FROM attempts a WHERE a.problem_id=p.id AND a.state='saved' AND a.understanding='independent') OR EXISTS(SELECT 1 FROM reviews r WHERE r.problem_id=p.id AND r.result='independent')),0) AS independent,
				(SELECT count(*) FROM homework_tasks WHERE state='completed') AS completed,(SELECT count(*) FROM (SELECT DISTINCT problem_id,reviewed_on FROM reviews)) AS recalls,(SELECT count(*) FROM card_answers WHERE correct=1) AS cards,
				(SELECT count(DISTINCT problem_id) FROM test_runs WHERE passed=total AND total>0) AS passedTests,(SELECT coalesce(sum(min(fails,3)),0) FROM (SELECT count(*) AS fails FROM test_runs WHERE passed<total GROUP BY problem_id,run_on)) AS failedRuns,
				(SELECT count(*) FROM homework_tasks t JOIN homework h ON h.id=t.homework_id WHERE t.state<>'cancelled' AND h.due_date<date('now') AND NOT EXISTS(SELECT 1 FROM submissions s WHERE s.task_id=t.id AND date(s.created_at)<=h.due_date)) AS late FROM problems p WHERE ${solvedSQL}`),
			env.DB.prepare("WITH days AS (SELECT DISTINCT date(saved_at) AS day FROM attempts WHERE state='saved') SELECT EXISTS(SELECT 1 FROM days WHERE date(day,'+1 day') IN (SELECT day FROM days) AND date(day,'+2 day') IN (SELECT day FROM days)) AS streak"),
		]), acceptedSetSlugs(env)]);
		const { accepted: count, hard, acceptedXp, independent, completed, recalls, cards, passedTests, failedRuns, late } = totals.results[0];
		const xp = Math.max(0, acceptedXp + 10 * independent + 15 * completed + 5 * recalls + 2 * cards + 10 * passedTests - 2 * failedRuns - 15 * late);
		let level = 1;
		while (xp >= 50 * level * (level + 1)) level++;
		const earned: Record<BadgeId, boolean> = { 'first-accept': count >= 1, 'three-day-streak': streak.results[0].streak === 1, 'first-hard': hard >= 1, 'ten-accepted': count >= 10, 'independent-five': independent >= 5, 'set-cleared': sets.some(set => tasksOf(set).every(task => accepted.has(taskSlug(task)))) };
		return Response.json({ xp, level, levelXp: 50 * level * (level - 1), nextLevelXp: 50 * level * (level + 1), late, badges: Object.entries(earned).map(([id, value]) => ({ id, earned: value })) } as Game);
	}
	const match = /^\/leetcode\/api\/problems\/([^/]+)\/(reviews|practice)$/.exec(url.pathname);
	if (!match) return null;
	const problemId = uuid(match[1]);
	methods(request, match[2] === 'practice' ? ['POST'] : ['GET', 'POST']);
	await getProblem(env, problemId);
	if (match[2] === 'practice') {
		// A random day in [today + 15, today + 45].
		const nextReviewDate = addCalendarDays(calendarDate(text(object(await readJson(request), ['today']).today, 10, true))!, 15 + crypto.getRandomValues(new Uint32Array(1))[0] % 31);
		await env.DB.prepare("UPDATE problems SET understanding='needs_practice',next_review_date=?,progress_version=progress_version+1,updated_at=? WHERE id=?").bind(nextReviewDate, new Date().toISOString(), problemId).run();
		return Response.json({ nextReviewDate });
	}
	if (request.method === 'GET') {
		const { limit, offset } = pagination(url);
		const rows = await env.DB.prepare(`SELECT ${reviewColumns} FROM reviews WHERE problem_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`).bind(problemId, limit + 1, offset).all<Revision>();
		return Response.json(page(rows.results, limit, offset));
	}
	requireRole(user, 'student');
	const data = object(await readJson(request), ['version', 'result', 'note', 'reviewedOn', 'nextReviewDate']);
	const date = calendarDate(data.nextReviewDate), version = integer(data.version), now = new Date().toISOString();
	const id = crypto.randomUUID(), result = choice(data.result, ['needs_practice', 'with_help', 'independent']);
	const note = text(data.note, 8000).trim(), reviewedOn = calendarDate(text(data.reviewedOn, 10, true));
	const results = await env.DB.batch([
		env.DB.prepare('INSERT INTO reviews SELECT ?,id,?,?,?,?,? FROM problems WHERE id=? AND progress_version=?').bind(id, result, note, reviewedOn, date, now, problemId, version),
		env.DB.prepare('UPDATE problems SET understanding=?,next_review_date=?,progress_version=progress_version+1,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM reviews WHERE id=?)').bind(result, date, now, problemId, id),
	]);
	changed(results[0]);
	return Response.json(await env.DB.prepare(`SELECT ${reviewColumns} FROM reviews WHERE id=?`).bind(id).first<Revision>(), { status: 201 });
}
