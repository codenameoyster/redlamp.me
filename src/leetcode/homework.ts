import type { Env } from '../index';
import type { Feedback, Homework, HomeworkBoard, HomeworkSummary, HomeworkTask, Role, SessionUser } from '../../shared/leetcode';
import { requireRole } from './auth';
import { assignableSQL, getProblem, searchText, solvedSQL } from './problems';
import { sets, taskSlug } from './sets';
import { calendarDate, changed, choice, HttpError, integer, methods, object, page, pagination, readJson, text, uuid } from './http';

const postponedSQL = '(SELECT to_date FROM postponements WHERE homework_id=h.id) AS postponedTo';
const homeworkColumns = `h.id,h.title,h.instructions,h.due_date AS dueDate,${postponedSQL},h.version,h.created_at AS createdAt,h.updated_at AS updatedAt`;
// ?1 is the viewer role. A later ? takes the next number. https://www.sqlite.org/lang_expr.html#varparam
const unreadSQL = "EXISTS(SELECT 1 FROM feedback f WHERE f.problem_id=t.problem_id AND f.author<>?1 AND f.created_at>coalesce((SELECT read_at FROM discussion_reads r WHERE r.role=?1 AND r.problem_id=t.problem_id),''))";
const taskColumns = `t.id,t.homework_id AS homeworkId,h.title AS homeworkTitle,h.instructions,h.due_date AS dueDate,${postponedSQL},t.problem_id AS problemId,p.title,p.difficulty,t.kind,t.set_slug AS setSlug,t.chapter,t.completed_at AS completedAt,t.state,t.current_submission_id AS submissionId,s.attempt_id AS submissionAttemptId,t.version,t.created_at AS createdAt,t.updated_at AS updatedAt,${unreadSQL} AS unread`;
const taskTables = 'homework_tasks t JOIN homework h ON h.id=t.homework_id LEFT JOIN problems p ON p.id=t.problem_id LEFT JOIN submissions s ON s.id=t.current_submission_id';
export const onTimeSQL = "SELECT count(*) FROM homework_tasks t JOIN homework h ON h.id=t.homework_id WHERE t.state<>'cancelled' AND (date(t.completed_at)<=h.due_date OR EXISTS(SELECT 1 FROM submissions s WHERE s.task_id=t.id AND date(s.created_at)<=h.due_date))";
const awardOnTime = (env: Env) => env.DB.prepare(`INSERT OR IGNORE INTO earned_badges SELECT 'on-time-five' WHERE (${onTimeSQL})>=5`);
const feedbackColumns = 'id,problem_id AS problemId,task_id AS taskId,submission_id AS submissionId,author,kind,body,created_at AS createdAt';
function unreadValue<T extends { unread: boolean }>(row: T): T { return { ...row, unread: Boolean(row.unread) }; }
function taskValue(row: HomeworkTask): HomeworkTask {
	if (row.kind === 'problem') return { ...unreadValue(row), href: `/leetcode/problems/${row.problemId}` };
	const set = sets.find(set => set.slug === row.setSlug)!, chapter = set.chapters[row.chapter! - 1];
	return { ...unreadValue(row), title: `${row.kind === 'quiz' ? 'Квиз' : 'Глава'} ${row.chapter}. ${chapter.title}`, href: row.kind === 'quiz' ? `/leetcode/quiz/${set.slug}-${row.chapter}` : `/leetcode/sets/${set.slug}/${row.chapter}` };
}
export async function dashboardHomework(env: Env, role: Role): Promise<{ waitingReview: number; tasks: HomeworkTask[] }> {
	const [count, tasks] = await env.DB.batch<HomeworkTask & { waitingReview: number }>([
		env.DB.prepare("SELECT count(*) AS waitingReview FROM homework_tasks t JOIN problems p ON p.id=t.problem_id WHERE t.state='submitted' AND p.archived_at IS NULL"),
		env.DB.prepare(`SELECT ${taskColumns} FROM ${taskTables} WHERE p.archived_at IS NULL AND t.state NOT IN ('completed','cancelled') ORDER BY ${role === 'parent' ? "(t.state='submitted') DESC,t.updated_at ASC" : "(t.state='submitted') ASC,h.due_date IS NULL,h.due_date ASC"},t.id LIMIT 10`).bind(role),
	]);
	return { waitingReview: count.results[0].waitingReview, tasks: tasks.results.map(taskValue) };
}
export async function getHomework(env: Env, id: string): Promise<Homework> {
	const row = await env.DB.prepare(`SELECT ${homeworkColumns} FROM homework h WHERE h.id=?`).bind(uuid(id)).first<Homework>();
	if (!row) throw new HttpError(404, 'not_found', 'Такой домашней работы нет.');
	return row;
}
async function getTask(env: Env, id: string, role: Role): Promise<HomeworkTask> {
	const row = await env.DB.prepare(`SELECT ${taskColumns} FROM ${taskTables} WHERE t.id=?`).bind(role, uuid(id)).first<HomeworkTask>();
	if (!row) throw new HttpError(404, 'not_found', 'Такого задания нет.');
	return taskValue(row);
}

export async function handleHomework(request: Request, env: Env, user: SessionUser): Promise<Response | null> {
	const url = new URL(request.url), now = new Date().toISOString();
	const content = /^\/leetcode\/api\/homework\/([^/]+)\/content$/.exec(url.pathname);
	if (content) {
		methods(request, ['POST']); requireRole(user, 'parent');
		const homeworkId = uuid(content[1]), data = object(await readJson(request), ['kind', 'setSlug', 'chapter']);
		const kind = choice(data.kind, ['chapter', 'quiz']), setSlug = text(data.setSlug, 100, true), number = integer(data.chapter, 1, 99);
		const set = sets.find(set => set.slug === setSlug), chapter = set?.chapters[number - 1];
		if (!chapter) throw new HttpError(404, 'not_found', 'Такой главы нет.');
		await getHomework(env, homeworkId);
		const statements: D1PreparedStatement[] = [], entries: { title: string; index: number; slug?: string }[] = [];
		for (const type of kind === 'chapter' ? ['chapter', 'quiz'] : ['quiz']) {
			entries.push({ title: `${type === 'chapter' ? 'Глава' : 'Квиз'} ${number}. ${chapter.title}`, index: statements.length });
			statements.push(env.DB.prepare("INSERT INTO homework_tasks (id,homework_id,kind,set_slug,chapter,state,created_at,updated_at) SELECT ?,?,?,?,?, 'assigned',?,? WHERE NOT EXISTS(SELECT 1 FROM homework_tasks WHERE homework_id=? AND kind=? AND set_slug=? AND chapter=? AND state<>'cancelled') ON CONFLICT DO NOTHING").bind(crypto.randomUUID(), homeworkId, type, setSlug, number, now, now, homeworkId, type, setSlug, number));
		}
		const problems = kind === 'chapter' ? chapter.tasks : [];
		for (const problem of problems) {
			const slug = taskSlug(problem);
			statements.push(env.DB.prepare('INSERT INTO problems (id,slug,number,title,difficulty,topics,summary,search_text,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(slug) DO NOTHING').bind(crypto.randomUUID(), slug, problem.number ?? null, problem.title, problem.difficulty, JSON.stringify(problem.topics), problem.note, searchText([problem.title, problem.number, ...problem.topics, problem.note].join(' ')), now, now));
			entries.push({ title: problem.title, index: statements.length, slug });
			statements.push(env.DB.prepare(`INSERT INTO homework_tasks (id,homework_id,problem_id,state,created_at,updated_at) SELECT ?,?,p.id,'assigned',?,? FROM problems p WHERE p.slug=? AND ${assignableSQL} ON CONFLICT DO NOTHING`).bind(crypto.randomUUID(), homeworkId, now, now, slug));
		}
		statements.push(env.DB.prepare(`SELECT p.slug,CASE WHEN p.archived_at IS NOT NULL THEN 'Задача в архиве.' WHEN ${solvedSQL} OR EXISTS(SELECT 1 FROM homework_tasks t WHERE t.problem_id=p.id AND t.state='completed') THEN 'Задача уже выполнена.' ELSE 'У задачи уже есть активное задание.' END AS reason FROM problems p WHERE p.slug IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(problems.map(taskSlug))));
		const results = await env.DB.batch<{ slug: string; reason: string }>(statements), reasons = new Map(results.at(-1)!.results.map(row => [row.slug, row.reason]));
		const skipped = entries.filter(entry => !results[entry.index].meta.changes).map(entry => ({ title: entry.title, reason: entry.slug ? reasons.get(entry.slug)! : 'Уже добавлено в домашнюю работу.' }));
		return Response.json({ added: entries.length - skipped.length, skipped }, { status: 201 });
	}
	const discussion = /^\/leetcode\/api\/problems\/([^/]+)\/feedback$/.exec(url.pathname);
	if (discussion) {
		methods(request, ['GET']);
		const problemId = uuid(discussion[1]); await getProblem(env, problemId);
		const { limit, offset } = pagination(url);
		const statements = [env.DB.prepare(`SELECT ${feedbackColumns} FROM feedback WHERE problem_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`).bind(problemId, limit + 1, offset)];
		if (!offset) statements.push(env.DB.prepare('INSERT INTO discussion_reads (role,problem_id,read_at) SELECT ?,problem_id,max(created_at) FROM feedback WHERE problem_id=? GROUP BY problem_id ON CONFLICT(role,problem_id) DO UPDATE SET read_at=excluded.read_at').bind(user.role, problemId));
		const [rows] = await env.DB.batch<Feedback>(statements);
		return Response.json(page(rows.results, limit, offset));
	}
	const bundle = /^\/leetcode\/api\/homework(?:\/([^/]+)(\/postpone)?)?$/.exec(url.pathname);
	if (bundle) {
		const id = bundle[1] ? uuid(bundle[1]) : null;
		if (bundle[2]) {
			methods(request, ['POST']); requireRole(user, 'student');
			// The UTC date, as in the late rule of /game.
			const today = now.slice(0, 10), version = integer(object(await readJson(request), ['version']).version), homework = await getHomework(env, id!);
			if (homework.postponedTo) throw new HttpError(409, 'postponed', 'Сила Бомжа уже использована для этой домашней работы.');
			if (!homework.dueDate || today > homework.dueDate) throw new HttpError(400, 'invalid_input', 'Перенести можно только срок, который ещё не прошёл.');
			changed((await env.DB.batch([
				env.DB.prepare("INSERT INTO postponements SELECT id,due_date,date(due_date,'+1 day'),? FROM homework WHERE id=? AND version=?").bind(now, id, version),
				env.DB.prepare("UPDATE homework SET due_date=date(due_date,'+1 day'),version=version+1,updated_at=? WHERE id=? AND version=?").bind(now, id, version),
			]))[0]);
			return Response.json(await getHomework(env, id!));
		}
		methods(request, id ? ['GET', 'PATCH'] : ['GET', 'POST']);
		if (request.method === 'GET') {
			if (id) {
				const homework = await getHomework(env, id);
				const tasks = await env.DB.prepare(`SELECT ${taskColumns} FROM ${taskTables} WHERE t.homework_id=? ORDER BY t.created_at,t.id`).bind(user.role, id).all<HomeworkTask>();
				return Response.json({ homework, tasks: tasks.results.map(taskValue) });
			}
			const { limit, offset } = pagination(url), q = text(url.searchParams.get('q') ?? '', 200);
			// lower() folds ASCII letters only. https://www.sqlite.org/lang_corefunc.html#lower
			const rows = await env.DB.prepare(`SELECT ${homeworkColumns},coalesce(sum(t.state<>'cancelled'),0) AS taskCount,coalesce(sum(t.state='completed'),0) AS completedCount,coalesce(sum(t.state='submitted'),0) AS submittedCount,coalesce(sum(t.state='changes_requested'),0) AS requestedCount,max(${unreadSQL}) AS unread
				FROM homework h LEFT JOIN homework_tasks t ON t.homework_id=h.id WHERE instr(lower(h.title),lower(?))>0 GROUP BY h.id ${url.searchParams.get('active') === '1' ? "HAVING count(t.id)=0 OR sum(t.state NOT IN ('completed','cancelled'))>0" : ''}
				ORDER BY submittedCount>0 DESC,h.created_at DESC,h.id LIMIT ? OFFSET ?`).bind(user.role, q, limit + 1, offset).all<HomeworkSummary>();
			return Response.json(page(rows.results.map(unreadValue), limit, offset));
		}
		requireRole(user, 'parent');
		const data = object(await readJson(request), ['title', 'instructions', 'dueDate', ...(id ? ['version'] : [])]);
		const title = text(data.title, 200, true).trim(), instructions = text(data.instructions, 8000).trim(), dueDate = calendarDate(data.dueDate ?? null);
		if (id) {
			await getHomework(env, id);
			const version = integer(data.version);
			// A new due date gives the student Сила Бомжа again. The delete reads the old due date before the update.
			changed((await env.DB.batch([
				awardOnTime(env),
				env.DB.prepare('DELETE FROM postponements WHERE homework_id=?1 AND EXISTS(SELECT 1 FROM homework WHERE id=?1 AND version=?2 AND due_date IS NOT ?3)').bind(id, version, dueDate),
				env.DB.prepare('UPDATE homework SET title=?,instructions=?,due_date=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(title, instructions, dueDate, now, id, version),
			]))[2]);
			return Response.json(await getHomework(env, id));
		}
		const newId = crypto.randomUUID();
		await env.DB.prepare('INSERT INTO homework (id,title,instructions,due_date,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(newId, title, instructions, dueDate, now, now).run();
		return Response.json(await getHomework(env, newId), { status: 201 });
	}
	const match = /^\/leetcode\/api\/tasks(?:\/([^/]+)\/(start|review|cancel|complete))?$/.exec(url.pathname);
	if (!match) return null;
	const id = match[1] ? uuid(match[1]) : null, action = match[2];
	methods(request, action ? ['POST'] : ['GET', 'POST']);
	if (request.method === 'GET') {
		if (url.searchParams.get('view') === 'board') {
			// The active homework with the earliest due date is in progress. The other active homework is in the future.
			const [active, accepted] = (await env.DB.batch<HomeworkTask>([
				env.DB.prepare(`SELECT ${taskColumns} FROM ${taskTables} WHERE t.state NOT IN ('completed','cancelled') ORDER BY h.due_date IS NULL,h.due_date,h.created_at,h.id,t.created_at,t.id`).bind(user.role),
				env.DB.prepare(`SELECT ${taskColumns} FROM ${taskTables} WHERE t.state='completed' ORDER BY t.updated_at DESC,t.id`).bind(user.role),
			])).map(rows => rows.results.map(taskValue));
			const current = active[0]?.homeworkId;
			return Response.json({ progress: active.filter(t => t.homeworkId === current), future: active.filter(t => t.homeworkId !== current), accepted } satisfies HomeworkBoard);
		}
		const { limit, offset } = pagination(url), where = ['1=1'], args: (string | number)[] = [];
		if (url.searchParams.has('problemId')) { where.push('t.problem_id=?'); args.push(uuid(url.searchParams.get('problemId'))); }
		if (url.searchParams.has('kind')) { where.push('t.kind=?'); args.push(choice(url.searchParams.get('kind'), ['problem', 'chapter', 'quiz'])); }
		if (url.searchParams.has('setSlug')) { where.push('t.set_slug=?'); args.push(text(url.searchParams.get('setSlug'), 100, true)); }
		if (url.searchParams.has('chapter')) { where.push('t.chapter=?'); args.push(integer(Number(url.searchParams.get('chapter')), 1, 99)); }
		const rows = await env.DB.prepare(`SELECT ${taskColumns} FROM ${taskTables} WHERE ${where.join(' AND ')} ORDER BY (t.state='submitted') DESC,t.created_at DESC,t.id LIMIT ? OFFSET ?`).bind(user.role, ...args, limit + 1, offset).all<HomeworkTask>();
		return Response.json(page(rows.results.map(taskValue), limit, offset));
	}
	requireRole(user, action === 'start' || action === 'complete' ? 'student' : 'parent');
	if (!id) {
		const data = object(await readJson(request), ['homeworkId', 'problemId']);
		const homeworkId = uuid(data.homeworkId), problemId = uuid(data.problemId), newId = crypto.randomUUID();
		await getHomework(env, homeworkId);
		const result = await env.DB.prepare(`INSERT INTO homework_tasks (id,homework_id,problem_id,state,created_at,updated_at) SELECT ?,?,p.id,'assigned',?,? FROM problems p WHERE p.id=? AND ${assignableSQL} ON CONFLICT DO NOTHING`).bind(newId, homeworkId, now, now, problemId).run();
		if (!result.meta.changes) {
			const problem = await getProblem(env, problemId);
			if (problem.archivedAt) throw new HttpError(409, 'archived', 'Верните задачу из архива, прежде чем назначать домашнюю работу.');
			if (problem.solved || await env.DB.prepare("SELECT 1 FROM homework_tasks WHERE problem_id=? AND state='completed'").bind(problemId).first()) throw new HttpError(409, 'completed_homework', 'Эта задача уже выполнена. Для повторения откройте задачу.');
			throw new HttpError(409, 'active_homework', 'У этой задачи уже есть активное задание. Откройте его, чтобы продолжить работу.');
		}
		return Response.json(await getTask(env, newId, user.role), { status: 201 });
	}
	const task = await getTask(env, id, user.role);
	if (action === 'review') {
		if (!task.problemId) throw new HttpError(400, 'invalid_input', 'На проверку отправляют решение задачи.');
		const data = object(await readJson(request), ['version', 'submissionId', 'decision', 'body']);
		const decision = choice(data.decision, ['changes_requested', 'completed']), body = text(data.body, 8000, decision === 'changes_requested').trim(), feedbackId = crypto.randomUUID();
		const result = await env.DB.batch([
			env.DB.prepare(`INSERT INTO feedback (id,problem_id,task_id,submission_id,author,kind,body,created_at) SELECT ?,problem_id,id,current_submission_id,'parent',?,?,? FROM homework_tasks WHERE id=? AND version=? AND state IN ${decision === 'completed' ? "('submitted')" : "('submitted','completed')"} AND current_submission_id=? AND (?='completed' OR EXISTS(SELECT 1 FROM problems WHERE id=homework_tasks.problem_id AND archived_at IS NULL))`).bind(feedbackId, decision, body, now, id, integer(data.version), uuid(data.submissionId), decision),
			env.DB.prepare('UPDATE homework_tasks SET state=?,version=version+1,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM feedback WHERE id=?)').bind(decision, now, id, feedbackId),
		]);
		if (!result[0].meta.changes && decision === 'changes_requested' && (await getProblem(env, task.problemId)).archivedAt) throw new HttpError(409, 'archived', 'Верните задачу из архива, прежде чем отправлять её на доработку.');
		changed(result[0]);
	} else if (action === 'complete') {
		const version = integer(object(await readJson(request), ['version']).version);
		changed(await env.DB.prepare("UPDATE homework_tasks SET state='completed',completed_at=?,version=version+1,updated_at=? WHERE id=? AND version=? AND kind='chapter' AND state IN ('assigned','in_progress')").bind(now, now, id, version).run());
	} else {
		const version = integer(object(await readJson(request), ['version']).version);
		changed((await env.DB.batch([
			...action === 'cancel' ? [awardOnTime(env)] : [],
			env.DB.prepare(`UPDATE homework_tasks SET state=?,version=version+1,updated_at=? WHERE id=? AND version=? AND ${action === 'start' ? "state='assigned'" : "state NOT IN ('completed','cancelled')"}`).bind(action === 'start' ? 'in_progress' : 'cancelled', now, id, version),
		])).at(-1)!);
	}
	return Response.json(await getTask(env, id, user.role));
}
