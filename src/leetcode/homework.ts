import type { Env } from '../index';
import type { Feedback, Homework, SessionUser, Submission } from '../../shared/leetcode';
import { requireRole } from './auth';
import { getAttempt } from './attempts';
import { getProblem } from './problems';
import { calendarDate, changed, choice, HttpError, integer, methods, object, page, pagination, readJson, text, uuid } from './http';

export const homeworkColumns = 'h.id,h.problem_id AS problemId,p.title AS problemTitle,h.instructions,h.due_date AS dueDate,h.state,h.current_submission_id AS submissionId,h.version,h.created_at AS createdAt,h.updated_at AS updatedAt';
const feedbackColumns = 'id,problem_id AS problemId,homework_id AS homeworkId,submission_id AS submissionId,author,kind,body,created_at AS createdAt';
export const editableHomework = "('assigned','in_progress','changes_requested')";
export async function getHomework(env: Env, id: string): Promise<Homework> {
	const row = await env.DB.prepare(`SELECT ${homeworkColumns} FROM homework h JOIN problems p ON p.id=h.problem_id WHERE h.id=?`).bind(uuid(id)).first<Homework>();
	if (!row) throw new HttpError(404, 'not_found', 'This assignment does not exist.');
	return row;
}

export async function handleHomework(request: Request, env: Env, user: SessionUser): Promise<Response | null> {
	const url = new URL(request.url), now = new Date().toISOString();
	const discussion = /^\/leetcode\/api\/problems\/([^/]+)\/feedback$/.exec(url.pathname);
	if (discussion) {
		methods(request, ['GET', 'POST']);
		const problemId = uuid(discussion[1]); await getProblem(env, problemId);
		if (request.method === 'GET') {
			const { limit, offset } = pagination(url);
			const rows = await env.DB.prepare(`SELECT ${feedbackColumns} FROM feedback WHERE problem_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`).bind(problemId, limit + 1, offset).all<Feedback>();
			return Response.json(page(rows.results, limit, offset));
		}
		const data = object(await readJson(request), ['body', 'homeworkId', 'submissionId']);
		const body = text(data.body, 8000, true).trim(), homeworkId = data.homeworkId == null ? null : uuid(data.homeworkId), submissionId = data.submissionId == null ? null : uuid(data.submissionId);
		if (homeworkId && (await getHomework(env, homeworkId)).problemId !== problemId) throw new HttpError(400, 'invalid_reference', 'Choose homework for this problem.');
		if (submissionId && !await env.DB.prepare('SELECT s.id FROM submissions s JOIN homework h ON h.id=s.homework_id WHERE s.id=? AND h.problem_id=? AND (? IS NULL OR h.id=?)').bind(submissionId, problemId, homeworkId, homeworkId).first()) throw new HttpError(400, 'invalid_reference', 'Choose a submission for this discussion.');
		const id = crypto.randomUUID();
		await env.DB.prepare("INSERT INTO feedback VALUES (?,?,?,?,?,'reply',?,?)").bind(id, problemId, homeworkId, submissionId, user.role, body, now).run();
		return Response.json(await env.DB.prepare(`SELECT ${feedbackColumns} FROM feedback WHERE id=?`).bind(id).first(), { status: 201 });
	}
	const match = /^\/leetcode\/api\/homework(?:\/([^/]+)(?:\/(start|submit|review|cancel))?)?$/.exec(url.pathname);
	if (!match) return null;
	const id = match[1] ? uuid(match[1]) : null, action = match[2];
	methods(request, action ? ['POST'] : id ? ['GET', 'PATCH'] : ['GET', 'POST']);
	if (request.method === 'GET') {
		if (id) {
			const homework = await getHomework(env, id);
			const submissions = await env.DB.prepare('SELECT id,homework_id AS homeworkId,attempt_id AS attemptId,homework_version AS homeworkVersion,created_at AS createdAt FROM submissions WHERE homework_id=? ORDER BY created_at DESC,id DESC LIMIT 50').bind(id).all<Submission>();
			return Response.json({ homework, submissions: submissions.results });
		}
		const { limit, offset } = pagination(url), where = ['1=1'], args: string[] = [];
		if (url.searchParams.has('problemId')) { where.push('h.problem_id=?'); args.push(uuid(url.searchParams.get('problemId'))); }
		if (url.searchParams.get('active') === '1') where.push("h.state NOT IN ('completed','cancelled')");
		const rows = await env.DB.prepare(`SELECT ${homeworkColumns} FROM homework h JOIN problems p ON p.id=h.problem_id WHERE ${where.join(' AND ')} ORDER BY (h.state='submitted') DESC,h.created_at DESC,h.id LIMIT ? OFFSET ?`).bind(...args, limit + 1, offset).all<Homework>();
		return Response.json(page(rows.results, limit, offset));
	}
	requireRole(user, action === 'submit' || action === 'start' ? 'student' : 'parent');
	if (!id) {
		const data = object(await readJson(request), ['problemId', 'instructions', 'dueDate']);
		const problemId = uuid(data.problemId); await getProblem(env, problemId);
		const newId = crypto.randomUUID();
		changed(await env.DB.prepare("INSERT INTO homework (id,problem_id,instructions,due_date,state,created_at,updated_at) SELECT ?,id,?,?,'assigned',?,? FROM problems WHERE id=? AND archived_at IS NULL ON CONFLICT DO NOTHING").bind(newId, text(data.instructions, 8000).trim(), calendarDate(data.dueDate ?? null), now, now, problemId).run());
		return Response.json(await getHomework(env, newId), { status: 201 });
	}
	const homework = await getHomework(env, id);
	if (action === 'submit') {
		const data = object(await readJson(request), ['version', 'attemptId', 'attemptVersion', 'nextReviewDate']);
		const attempt = await getAttempt(env, homework.problemId, uuid(data.attemptId));
		if (![attempt.document.notes, ...attempt.document.approaches.flatMap(a => [a.idea, a.correctness, a.mistakes, a.code])].some(value => value.trim())) throw new HttpError(400, 'empty_attempt', 'Add an explanation, notes, or code before submitting.');
		const submissionId = crypto.randomUUID(), hasDate = Object.hasOwn(data, 'nextReviewDate');
		const date = hasDate ? calendarDate(data.nextReviewDate) : null;
		const statements = [env.DB.prepare(`INSERT INTO submissions (id,homework_id,attempt_id,homework_version,created_at) SELECT ?,h.id,a.id,h.version+1,? FROM homework h JOIN attempts a ON a.problem_id=h.problem_id WHERE h.id=? AND h.version=? AND h.state IN ${editableHomework} AND a.id=? AND a.version=? AND a.state=?`).bind(submissionId, now, id, integer(data.version), attempt.id, integer(data.attemptVersion), attempt.state)];
		if (attempt.state === 'draft') statements.push(
			env.DB.prepare("UPDATE attempts SET state='saved',version=version+1,saved_at=?1,updated_at=?1 WHERE id=?2 AND state='draft' AND EXISTS(SELECT 1 FROM submissions WHERE id=?3 AND attempt_id=attempts.id)").bind(now, attempt.id, submissionId),
			env.DB.prepare('UPDATE problems SET understanding=(SELECT understanding FROM attempts WHERE id=?1),next_review_date=CASE WHEN ?2 THEN ?3 ELSE next_review_date END,version=version+1,updated_at=?4 WHERE id=?5 AND EXISTS(SELECT 1 FROM submissions WHERE id=?6)').bind(attempt.id, hasDate ? 1 : 0, date, now, homework.problemId, submissionId),
		);
		statements.push(env.DB.prepare("UPDATE homework SET state='submitted',current_submission_id=?1,version=version+1,updated_at=?2 WHERE id=?3 AND EXISTS(SELECT 1 FROM submissions WHERE id=?1 AND homework_id=homework.id)").bind(submissionId, now, id));
		changed((await env.DB.batch(statements))[0]);
	} else if (action === 'review') {
		const data = object(await readJson(request), ['version', 'submissionId', 'decision', 'body']);
		const decision = choice(data.decision, ['changes_requested', 'completed']), body = text(data.body, 8000, decision === 'changes_requested').trim(), feedbackId = crypto.randomUUID();
		const result = await env.DB.batch([
			env.DB.prepare("INSERT INTO feedback (id,problem_id,homework_id,submission_id,author,kind,body,created_at) SELECT ?,problem_id,id,current_submission_id,'parent',?,?,? FROM homework WHERE id=? AND version=? AND state='submitted' AND current_submission_id=?").bind(feedbackId, decision, body, now, id, integer(data.version), uuid(data.submissionId)),
			env.DB.prepare('UPDATE homework SET state=?,version=version+1,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM feedback WHERE id=?)').bind(decision, now, id, feedbackId),
		]);
		changed(result[0]);
	} else {
		const data = object(await readJson(request), action ? ['version'] : ['version', 'instructions', 'dueDate']);
		const version = integer(data.version);
		if (action === 'start' || action === 'cancel') changed(await env.DB.prepare(`UPDATE homework SET state=?,version=version+1,updated_at=? WHERE id=? AND version=? AND ${action === 'start' ? "state='assigned'" : "state NOT IN ('completed','cancelled')"}`).bind(action === 'start' ? 'in_progress' : 'cancelled', now, id, version).run());
		else changed(await env.DB.prepare(`UPDATE homework SET instructions=?,due_date=?,version=version+1,updated_at=? WHERE id=? AND version=? AND state IN ${editableHomework}`).bind(text(data.instructions, 8000).trim(), calendarDate(data.dueDate ?? null), now, id, version).run());
	}
	return Response.json(await getHomework(env, id));
}
