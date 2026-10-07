import type { Env } from '../index';
import type { Dashboard, Homework, Revision, SessionUser } from '../../shared/leetcode';
import { requireRole } from './auth';
import { attemptColumns } from './attempts';
import { homeworkColumns } from './homework';
import { getProblem, problemColumns, problemValue, solvedSQL } from './problems';
import { calendarDate, changed, choice, integer, methods, object, page, pagination, readJson, text, uuid } from './http';

const reviewColumns = 'id,problem_id AS problemId,result,note,reviewed_on AS reviewedOn,next_review_date AS nextReviewDate,created_at AS createdAt';

export async function handleReviews(request: Request, env: Env, user: SessionUser): Promise<Response | null> {
	const url = new URL(request.url);
	if (url.pathname === '/leetcode/api/dashboard') {
		methods(request, ['GET']);
		const today = calendarDate(text(url.searchParams.get('today'), 10, true));
		const [progress, assignments, topics, homework, drafts, dueReviews] = await env.DB.batch<Record<string, unknown>>([
			env.DB.prepare(`SELECT count(*) AS recorded,coalesce(sum(${solvedSQL}),0) AS solved,coalesce(sum(${solvedSQL} AND p.understanding='independent'),0) AS independent,coalesce(sum(p.next_review_date<=?),0) AS dueReviews FROM problems p WHERE p.archived_at IS NULL`).bind(today),
			env.DB.prepare("SELECT count(*) AS activeHomework,coalesce(sum(h.state='submitted'),0) AS waitingReview,coalesce(sum(h.due_date<?),0) AS overdueHomework FROM homework h JOIN problems p ON p.id=h.problem_id WHERE h.state NOT IN ('completed','cancelled') AND p.archived_at IS NULL").bind(today),
			env.DB.prepare(`SELECT t.value AS topic,count(*) AS solved,sum(p.understanding='independent') AS independent FROM problems p,json_each(p.topics) t WHERE p.archived_at IS NULL AND ${solvedSQL} GROUP BY t.value ORDER BY t.value LIMIT 50`),
			env.DB.prepare(`SELECT ${homeworkColumns} FROM homework h JOIN problems p ON p.id=h.problem_id WHERE p.archived_at IS NULL AND h.state NOT IN ('completed','cancelled') ORDER BY ${user.role === 'parent' ? "(h.state='submitted') DESC,h.updated_at ASC" : "(h.state='submitted') ASC,h.due_date IS NULL,h.due_date ASC"},h.id LIMIT 10`),
			env.DB.prepare(`SELECT ${attemptColumns},(SELECT title FROM problems p WHERE p.id=attempts.problem_id) AS problemTitle FROM attempts WHERE state='draft' AND EXISTS(SELECT 1 FROM problems p WHERE p.id=attempts.problem_id AND p.archived_at IS NULL) ORDER BY updated_at DESC,id LIMIT 5`),
			env.DB.prepare(`SELECT ${problemColumns} FROM problems p WHERE p.archived_at IS NULL AND p.next_review_date<=? ORDER BY p.next_review_date,p.id LIMIT 10`).bind(today),
		]);
		return Response.json({ counts: { ...progress.results[0], ...assignments.results[0] }, topics: topics.results, homework: homework.results as unknown as Homework[], drafts: drafts.results, dueReviews: dueReviews.results.map(row => problemValue(row as unknown as Parameters<typeof problemValue>[0])) } as Dashboard);
	}
	const match = /^\/leetcode\/api\/problems\/([^/]+)\/(reviews|review-date)$/.exec(url.pathname);
	if (!match) return null;
	const problemId = uuid(match[1]), dateOnly = match[2] === 'review-date';
	methods(request, dateOnly ? ['PATCH'] : ['GET', 'POST']);
	await getProblem(env, problemId);
	if (request.method === 'GET') {
		const { limit, offset } = pagination(url);
		const rows = await env.DB.prepare(`SELECT ${reviewColumns} FROM reviews WHERE problem_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`).bind(problemId, limit + 1, offset).all<Revision>();
		return Response.json(page(rows.results, limit, offset));
	}
	requireRole(user, 'student');
	const data = object(await readJson(request), dateOnly ? ['version', 'nextReviewDate'] : ['version', 'result', 'note', 'reviewedOn', 'nextReviewDate']);
	const date = calendarDate(data.nextReviewDate), version = integer(data.version), now = new Date().toISOString();
	if (dateOnly) {
		changed(await env.DB.prepare('UPDATE problems SET next_review_date=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(date, now, problemId, version).run());
		return Response.json(await getProblem(env, problemId));
	}
	const id = crypto.randomUUID(), result = choice(data.result, ['needs_practice', 'with_help', 'independent']);
	const note = text(data.note, 8000).trim(), reviewedOn = calendarDate(text(data.reviewedOn, 10, true));
	const results = await env.DB.batch([
		env.DB.prepare('INSERT INTO reviews SELECT ?,id,?,?,?,?,? FROM problems WHERE id=? AND version=?').bind(id, result, note, reviewedOn, date, now, problemId, version),
		env.DB.prepare('UPDATE problems SET understanding=?,next_review_date=?,version=version+1,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM reviews WHERE id=?)').bind(result, date, now, problemId, id),
	]);
	changed(results[0]);
	return Response.json(await env.DB.prepare(`SELECT ${reviewColumns} FROM reviews WHERE id=?`).bind(id).first<Revision>(), { status: 201 });
}
