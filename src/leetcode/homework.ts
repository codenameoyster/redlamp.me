import type { Env } from '../index';
import type { Feedback, Homework, HomeworkSummary, HomeworkTask, SessionUser, Submission } from '../../shared/leetcode';
import { requireRole } from './auth';
import { getAttempt, saveProgress } from './attempts';
import { getProblem } from './problems';
import { calendarDate, changed, choice, HttpError, integer, methods, object, page, pagination, readJson, text, uuid } from './http';

const homeworkColumns = 'h.id,h.title,h.instructions,h.due_date AS dueDate,h.version,h.created_at AS createdAt,h.updated_at AS updatedAt';
export const taskColumns = 't.id,t.homework_id AS homeworkId,h.title AS homeworkTitle,h.instructions,h.due_date AS dueDate,t.problem_id AS problemId,p.title AS problemTitle,p.difficulty,t.state,t.current_submission_id AS submissionId,t.version,t.created_at AS createdAt,t.updated_at AS updatedAt';
export const taskTables = 'homework_tasks t JOIN homework h ON h.id=t.homework_id JOIN problems p ON p.id=t.problem_id';
const feedbackColumns = 'id,problem_id AS problemId,task_id AS taskId,submission_id AS submissionId,author,kind,body,created_at AS createdAt';
const editableTask = "('assigned','in_progress','changes_requested')";
export async function getHomework(env: Env, id: string): Promise<Homework> {
	const row = await env.DB.prepare(`SELECT ${homeworkColumns} FROM homework h WHERE h.id=?`).bind(uuid(id)).first<Homework>();
	if (!row) throw new HttpError(404, 'not_found', 'This homework does not exist.');
	return row;
}
async function getTask(env: Env, id: string): Promise<HomeworkTask> {
	const row = await env.DB.prepare(`SELECT ${taskColumns} FROM ${taskTables} WHERE t.id=?`).bind(uuid(id)).first<HomeworkTask>();
	if (!row) throw new HttpError(404, 'not_found', 'This task does not exist.');
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
		const data = object(await readJson(request), ['body', 'taskId', 'submissionId']);
		const body = text(data.body, 8000, true).trim(), taskId = data.taskId == null ? null : uuid(data.taskId), submissionId = data.submissionId == null ? null : uuid(data.submissionId);
		if (taskId && (await getTask(env, taskId)).problemId !== problemId) throw new HttpError(400, 'invalid_reference', 'Choose a task for this problem.');
		if (submissionId && !await env.DB.prepare('SELECT s.id FROM submissions s JOIN homework_tasks t ON t.id=s.task_id WHERE s.id=? AND t.problem_id=? AND (? IS NULL OR t.id=?)').bind(submissionId, problemId, taskId, taskId).first()) throw new HttpError(400, 'invalid_reference', 'Choose a submission for this discussion.');
		const id = crypto.randomUUID();
		await env.DB.prepare("INSERT INTO feedback VALUES (?,?,?,?,?,'reply',?,?)").bind(id, problemId, taskId, submissionId, user.role, body, now).run();
		return Response.json(await env.DB.prepare(`SELECT ${feedbackColumns} FROM feedback WHERE id=?`).bind(id).first(), { status: 201 });
	}
	const bundle = /^\/leetcode\/api\/homework(?:\/([^/]+))?$/.exec(url.pathname);
	if (bundle) {
		const id = bundle[1] ? uuid(bundle[1]) : null;
		methods(request, id ? ['GET', 'PATCH'] : ['GET', 'POST']);
		if (request.method === 'GET') {
			if (id) {
				const homework = await getHomework(env, id);
				const tasks = await env.DB.prepare(`SELECT ${taskColumns} FROM ${taskTables} WHERE t.homework_id=? ORDER BY t.created_at,t.id`).bind(id).all<HomeworkTask>();
				return Response.json({ homework, tasks: tasks.results });
			}
			const { limit, offset } = pagination(url), q = text(url.searchParams.get('q') ?? '', 200);
			// lower() folds ASCII letters only. https://www.sqlite.org/lang_corefunc.html#lower
			const rows = await env.DB.prepare(`SELECT ${homeworkColumns},coalesce(sum(t.state<>'cancelled'),0) AS taskCount,coalesce(sum(t.state='completed'),0) AS completedCount,coalesce(sum(t.state='submitted'),0) AS submittedCount,coalesce(sum(t.state='changes_requested'),0) AS requestedCount
				FROM homework h LEFT JOIN homework_tasks t ON t.homework_id=h.id WHERE instr(lower(h.title),lower(?))>0 GROUP BY h.id ${url.searchParams.get('active') === '1' ? "HAVING count(t.id)=0 OR sum(t.state NOT IN ('completed','cancelled'))>0" : ''}
				ORDER BY submittedCount>0 DESC,h.created_at DESC,h.id LIMIT ? OFFSET ?`).bind(q, limit + 1, offset).all<HomeworkSummary>();
			return Response.json(page(rows.results, limit, offset));
		}
		requireRole(user, 'parent');
		const data = object(await readJson(request), ['title', 'instructions', 'dueDate', ...(id ? ['version'] : [])]);
		const title = text(data.title, 200, true).trim(), instructions = text(data.instructions, 8000).trim(), dueDate = calendarDate(data.dueDate ?? null);
		if (id) {
			await getHomework(env, id);
			changed(await env.DB.prepare('UPDATE homework SET title=?,instructions=?,due_date=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(title, instructions, dueDate, now, id, integer(data.version)).run());
			return Response.json(await getHomework(env, id));
		}
		const newId = crypto.randomUUID();
		await env.DB.prepare('INSERT INTO homework (id,title,instructions,due_date,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(newId, title, instructions, dueDate, now, now).run();
		return Response.json(await getHomework(env, newId), { status: 201 });
	}
	const match = /^\/leetcode\/api\/tasks(?:\/([^/]+)(?:\/(start|submit|review|cancel))?)?$/.exec(url.pathname);
	if (!match) return null;
	const id = match[1] ? uuid(match[1]) : null, action = match[2];
	methods(request, action ? ['POST'] : id ? ['GET'] : ['GET', 'POST']);
	if (request.method === 'GET') {
		if (id) {
			const task = await getTask(env, id);
			const submissions = await env.DB.prepare('SELECT id,task_id AS taskId,attempt_id AS attemptId,task_version AS taskVersion,created_at AS createdAt FROM submissions WHERE task_id=? ORDER BY created_at DESC,id DESC LIMIT 50').bind(id).all<Submission>();
			return Response.json({ homework: await getHomework(env, task.homeworkId), task, submissions: submissions.results });
		}
		const { limit, offset } = pagination(url), where = ['1=1'], args: string[] = [];
		if (url.searchParams.has('problemId')) { where.push('t.problem_id=?'); args.push(uuid(url.searchParams.get('problemId'))); }
		if (url.searchParams.get('active') === '1') where.push("t.state NOT IN ('completed','cancelled')");
		const rows = await env.DB.prepare(`SELECT ${taskColumns} FROM ${taskTables} WHERE ${where.join(' AND ')} ORDER BY (t.state='submitted') DESC,t.created_at DESC,t.id LIMIT ? OFFSET ?`).bind(...args, limit + 1, offset).all<HomeworkTask>();
		return Response.json(page(rows.results, limit, offset));
	}
	requireRole(user, action === 'submit' || action === 'start' ? 'student' : 'parent');
	if (!id) {
		const data = object(await readJson(request), ['homeworkId', 'problemId']);
		const homeworkId = uuid(data.homeworkId), problemId = uuid(data.problemId), newId = crypto.randomUUID();
		await getHomework(env, homeworkId);
		const result = await env.DB.prepare("INSERT INTO homework_tasks (id,homework_id,problem_id,state,created_at,updated_at) SELECT ?,?,id,'assigned',?,? FROM problems WHERE id=? AND archived_at IS NULL ON CONFLICT DO NOTHING").bind(newId, homeworkId, now, now, problemId).run();
		if (!result.meta.changes) throw (await getProblem(env, problemId)).archivedAt ? new HttpError(409, 'archived', 'Restore this problem before you assign homework.') : new HttpError(409, 'active_homework', 'This problem already has an active task. Complete or cancel that task first.');
		return Response.json(await getTask(env, newId), { status: 201 });
	}
	const task = await getTask(env, id);
	if (action === 'submit') {
		const data = object(await readJson(request), ['version', 'attemptId', 'attemptVersion', 'nextReviewDate']);
		const attempt = await getAttempt(env, task.problemId, uuid(data.attemptId));
		if (![attempt.document.notes, ...attempt.document.approaches.flatMap(a => [a.idea, a.correctness, a.mistakes, a.code])].some(value => value.trim())) throw new HttpError(400, 'empty_attempt', 'Add an explanation, notes, or code before submitting.');
		const submissionId = crypto.randomUUID(), progress = saveProgress(env, task.problemId, attempt.id, data, now);
		const statements = [env.DB.prepare(`INSERT INTO submissions (id,task_id,attempt_id,task_version,created_at) SELECT ?,t.id,a.id,t.version+1,? FROM homework_tasks t JOIN attempts a ON a.problem_id=t.problem_id WHERE t.id=? AND t.version=? AND t.state IN ${editableTask} AND a.id=? AND a.version=? AND a.state=?`).bind(submissionId, now, id, integer(data.version), attempt.id, integer(data.attemptVersion), attempt.state)];
		if (attempt.state === 'draft') statements.push(
			env.DB.prepare("UPDATE attempts SET state='saved',version=version+1,saved_at=?1,updated_at=?1 WHERE id=?2 AND state='draft' AND EXISTS(SELECT 1 FROM submissions WHERE id=?3 AND attempt_id=attempts.id)").bind(now, attempt.id, submissionId),
			progress,
		);
		statements.push(env.DB.prepare("UPDATE homework_tasks SET state='submitted',current_submission_id=?1,version=version+1,updated_at=?2 WHERE id=?3 AND EXISTS(SELECT 1 FROM submissions WHERE id=?1 AND task_id=homework_tasks.id)").bind(submissionId, now, id));
		changed((await env.DB.batch(statements))[0]);
	} else if (action === 'review') {
		const data = object(await readJson(request), ['version', 'submissionId', 'decision', 'body']);
		const decision = choice(data.decision, ['changes_requested', 'completed']), body = text(data.body, 8000, decision === 'changes_requested').trim(), feedbackId = crypto.randomUUID();
		const result = await env.DB.batch([
			env.DB.prepare("INSERT INTO feedback (id,problem_id,task_id,submission_id,author,kind,body,created_at) SELECT ?,problem_id,id,current_submission_id,'parent',?,?,? FROM homework_tasks WHERE id=? AND version=? AND state='submitted' AND current_submission_id=?").bind(feedbackId, decision, body, now, id, integer(data.version), uuid(data.submissionId)),
			env.DB.prepare('UPDATE homework_tasks SET state=?,version=version+1,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM feedback WHERE id=?)').bind(decision, now, id, feedbackId),
		]);
		changed(result[0]);
	} else {
		const version = integer(object(await readJson(request), ['version']).version);
		changed(await env.DB.prepare(`UPDATE homework_tasks SET state=?,version=version+1,updated_at=? WHERE id=? AND version=? AND ${action === 'start' ? "state='assigned'" : "state NOT IN ('completed','cancelled')"}`).bind(action === 'start' ? 'in_progress' : 'cancelled', now, id, version).run());
	}
	return Response.json(await getTask(env, id));
}
