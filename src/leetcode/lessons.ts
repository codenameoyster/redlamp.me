import type { Env } from '../index';
import { MAX_LESSON_BYTES, MAX_UPLOAD_BYTES, type Lesson, type SessionUser } from '../../shared/leetcode';
import { requireRole } from './auth';
import { getProblem } from './problems';
import { getHomework } from './homework';
import { changed, HttpError, integer, methods, object, page, pagination, readBody, readJson, text, topics, uuid } from './http';

const lessonColumns = 'l.id,l.title,l.description,l.topics,l.filename,l.byte_count AS byteCount,l.archived_at AS archivedAt,l.version,l.created_at AS createdAt,l.updated_at AS updatedAt';
type LessonRow = Omit<Lesson, 'topics'> & { topics: string };
function lessonValue(row: LessonRow): Lesson { return { ...row, topics: JSON.parse(row.topics) }; }
async function getLesson(env: Env, id: string): Promise<Lesson> {
	const row = await env.DB.prepare(`SELECT ${lessonColumns} FROM lessons l WHERE id=?`).bind(uuid(id)).first<LessonRow>();
	if (!row) throw new HttpError(404, 'not_found', 'This lesson does not exist.');
	return lessonValue(row);
}
function metadata(value: unknown, version = false) {
	const data = object(value, ['title', 'description', 'topics', ...(version ? ['version'] : [])]);
	return { title: text(data.title, 200, true).trim(), description: text(data.description ?? '', 8000).trim(), topics: topics(data.topics ?? []), version: version ? integer(data.version) : 1 };
}
const LESSON_CSP = "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data: blob:; media-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";

export async function handleLessons(request: Request, env: Env, user: SessionUser): Promise<Response | null> {
	const url = new URL(request.url), now = new Date().toISOString();
	const link = /^\/leetcode\/api\/(problems|homework)\/([^/]+)\/lessons(?:\/([^/]+))?$/.exec(url.pathname);
	if (link) {
		const homework = link[1] === 'homework', ownerId = uuid(link[2]), lessonId = link[3] ? uuid(link[3]) : null;
		const table = homework ? 'homework_lessons' : 'problem_lessons', field = homework ? 'homework_id' : 'problem_id';
		methods(request, lessonId ? ['PUT', 'DELETE'] : ['GET']);
		if (homework) await getHomework(env, ownerId); else await getProblem(env, ownerId);
		if (!lessonId) {
			const { limit, offset } = pagination(url);
			const rows = await env.DB.prepare(`SELECT ${lessonColumns} FROM lessons l JOIN ${table} x ON x.lesson_id=l.id WHERE x.${field}=? ORDER BY l.title,l.id LIMIT ? OFFSET ?`).bind(ownerId, limit + 1, offset).all<LessonRow>();
			return Response.json(page(rows.results.map(lessonValue), limit, offset));
		}
		requireRole(user, 'parent');
		const lesson = await getLesson(env, lessonId), adding = request.method === 'PUT';
		if (adding && lesson.archivedAt) throw new HttpError(409, 'archived', 'Choose an active lesson.');
		if (homework) {
			const data = object(await readJson(request), ['version']);
			const result = await env.DB.batch([
				env.DB.prepare('UPDATE homework SET version=version+1,updated_at=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM lessons WHERE id=? AND (?=0 OR archived_at IS NULL))').bind(now, ownerId, integer(data.version), lessonId, adding ? 1 : 0),
				adding ? env.DB.prepare('INSERT INTO homework_lessons SELECT ?,? WHERE changes()=1 ON CONFLICT DO NOTHING').bind(ownerId, lessonId) : env.DB.prepare('DELETE FROM homework_lessons WHERE homework_id=? AND lesson_id=? AND changes()=1').bind(ownerId, lessonId),
			]);
			changed(result[0]);
		} else if (adding) {
			await env.DB.prepare('INSERT INTO problem_lessons SELECT ?,id FROM lessons WHERE id=? AND archived_at IS NULL ON CONFLICT DO NOTHING').bind(ownerId, lessonId).run();
		} else await env.DB.prepare('DELETE FROM problem_lessons WHERE problem_id=? AND lesson_id=?').bind(ownerId, lessonId).run();
		return new Response(null, { status: 204 });
	}
	const match = /^\/leetcode\/api\/lessons(?:\/([^/]+)(?:\/(content|download|archive))?)?$/.exec(url.pathname);
	if (!match) return null;
	const id = match[1] ? uuid(match[1]) : null, action = match[2];
	methods(request, action === 'content' || action === 'download' ? ['GET', 'HEAD'] : action ? ['POST'] : id ? ['GET', 'PATCH'] : ['GET', 'POST']);
	if (request.method === 'GET' || request.method === 'HEAD') {
		if (id) {
			const lesson = await getLesson(env, id);
			if (!action) return Response.json(lesson);
			const row = await env.DB.prepare('SELECT html FROM lesson_content WHERE lesson_id=?').bind(id).first<{ html: string }>();
			const headers: Record<string, string> = action === 'content' ? { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': LESSON_CSP } : { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="lesson-${id}.html"` };
			return new Response(new TextEncoder().encode(row!.html), { headers });
		}
		const { limit, offset } = pagination(url);
		const rows = await env.DB.prepare(`SELECT ${lessonColumns} FROM lessons l WHERE archived_at IS ${url.searchParams.get('archived') === '1' ? 'NOT ' : ''}NULL ORDER BY created_at DESC,id LIMIT ? OFFSET ?`).bind(limit + 1, offset).all<LessonRow>();
		return Response.json(page(rows.results.map(lessonValue), limit, offset));
	}
	requireRole(user, 'parent');
	if (id) {
		await getLesson(env, id);
		if (action === 'archive') {
			const data = object(await readJson(request), ['version']);
			changed(await env.DB.prepare('UPDATE lessons SET archived_at=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(now, now, id, integer(data.version)).run());
		} else {
			const data = metadata(await readJson(request), true);
			changed(await env.DB.prepare('UPDATE lessons SET title=?,description=?,topics=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(data.title, data.description, JSON.stringify(data.topics), now, id, data.version).run());
		}
		return Response.json(await getLesson(env, id));
	}
	if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new HttpError(400, 'invalid_upload', 'Choose an HTML file.');
	const bytes = await readBody(request, MAX_UPLOAD_BYTES);
	let form: FormData;
	try { form = await new Response(bytes, { headers: { 'Content-Type': request.headers.get('content-type')! } }).formData(); }
	catch { throw new HttpError(400, 'invalid_upload', 'The upload is invalid.'); }
	const file = form.get('file');
	if (!(file instanceof File) || !/\.html?$/i.test(file.name) || file.name.length > 200 || file.size === 0) throw new HttpError(400, 'invalid_upload', 'Choose a nonempty .html or .htm file.');
	if (file.size > MAX_LESSON_BYTES) throw new HttpError(413, 'too_large', 'Keep HTML files within 1,000,000 bytes.');
	let html: string, raw: unknown;
	try { html = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer()); raw = JSON.parse(text(form.get('metadata'), 32_768)); }
	catch { throw new HttpError(400, 'invalid_upload', 'Use UTF-8 HTML and valid lesson details.'); }
	const data = metadata(raw), newId = crypto.randomUUID();
	await env.DB.batch([
		env.DB.prepare('INSERT INTO lessons (id,title,description,topics,filename,byte_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(newId, data.title, data.description, JSON.stringify(data.topics), file.name, file.size, now, now),
		env.DB.prepare('INSERT INTO lesson_content VALUES (?,?)').bind(newId, html),
	]);
	return Response.json(await getLesson(env, newId), { status: 201 });
}
