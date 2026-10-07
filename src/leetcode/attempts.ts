import type { Env } from '../index';
import { MAX_DOCUMENT_BYTES, newApproach, type Attempt, type AttemptDocument, type AttemptSummary, type SessionUser } from '../../shared/leetcode';
import { requireRole } from './auth';
import { calendarDate, changed, choice, HttpError, integer, methods, object, page, pagination, readJson, text, uuid } from './http';
import { getProblem, searchText } from './problems';

export const attemptColumns = 'id,problem_id AS problemId,state,acceptance,understanding,version,created_at AS createdAt,updated_at AS updatedAt,saved_at AS savedAt';
type AttemptRow = Omit<Attempt, 'document'> & { document: string };
function attemptValue(row: AttemptRow): Attempt { return { ...row, document: JSON.parse(row.document) }; }
export async function getAttempt(env: Env, problemId: string, id: string): Promise<Attempt> {
	const row = await env.DB.prepare(`SELECT ${attemptColumns},document FROM attempts WHERE id=? AND problem_id=?`).bind(uuid(id), uuid(problemId)).first<AttemptRow>();
	if (!row) throw new HttpError(404, 'not_found', 'This attempt does not exist.');
	return attemptValue(row);
}

function documentValue(value: unknown): AttemptDocument {
	const doc = object(value, ['notes', 'approaches']);
	text(doc.notes, MAX_DOCUMENT_BYTES);
	if (!Array.isArray(doc.approaches) || doc.approaches.length < 1 || doc.approaches.length > 8) throw new HttpError(400, 'invalid_input', 'Use one to eight approaches.');
	const keys = ['id', 'label', 'idea', 'correctness', 'timeComplexity', 'spaceComplexity', 'edgeCases', 'mistakes', 'language', 'code'];
	const ids = new Set<string>();
	for (const value of doc.approaches) {
		const approach = object(value, keys);
		const id = uuid(approach.id);
		if (ids.has(id)) throw new HttpError(400, 'invalid_input', 'Each approach needs its own ID.');
		ids.add(id);
		for (const key of keys.slice(1)) text(approach[key], key === 'label' ? 200 : key === 'language' ? 40 : MAX_DOCUMENT_BYTES);
	}
	return doc as unknown as AttemptDocument;
}
function attemptSearch(document: AttemptDocument): string {
	return searchText([document.notes, ...document.approaches.flatMap(a => [a.label, a.idea, a.correctness, a.timeComplexity, a.spaceComplexity, a.edgeCases, a.mistakes])].join(' '));
}
// Run directly after the statement that finalizes the attempt: changes() reads its row count. https://www.sqlite.org/lang_corefunc.html#changes
export function saveProgress(env: Env, problemId: string, attemptId: string, data: Record<string, unknown>, now: string): D1PreparedStatement {
	const hasDate = Object.hasOwn(data, 'nextReviewDate');
	return env.DB.prepare('UPDATE problems SET understanding=(SELECT understanding FROM attempts WHERE id=?),next_review_date=CASE WHEN ? THEN ? ELSE next_review_date END,progress_version=progress_version+1,updated_at=? WHERE id=? AND changes()=1').bind(attemptId, hasDate ? 1 : 0, hasDate ? calendarDate(data.nextReviewDate) : null, now, problemId);
}

export async function handleAttempts(request: Request, env: Env, user: SessionUser): Promise<Response | null> {
	const url = new URL(request.url);
	const match = /^\/leetcode\/api\/problems\/([^/]+)\/attempts(?:\/([^/]+)(\/save)?)?$/.exec(url.pathname);
	if (!match) return null;
	const problemId = uuid(match[1]);
	const id = match[2] ? uuid(match[2]) : null;
	methods(request, id ? match[3] ? ['POST'] : ['GET', 'PUT'] : ['GET', 'POST']);
	if (request.method === 'GET' || !id) await getProblem(env, problemId);
	if (request.method === 'GET') {
		if (id) return Response.json(await getAttempt(env, problemId, id));
		const { limit, offset } = pagination(url);
		const rows = await env.DB.prepare(`SELECT ${attemptColumns} FROM attempts WHERE problem_id=? ORDER BY state ASC,created_at DESC,id LIMIT ? OFFSET ?`).bind(problemId, limit + 1, offset).all<AttemptSummary>();
		return Response.json(page(rows.results, limit, offset));
	}
	requireRole(user, 'student');
	const now = new Date().toISOString();
	if (!id) {
		const data = object(await readJson(request), ['copyAttemptId']);
		const source = data.copyAttemptId ? await getAttempt(env, problemId, uuid(data.copyAttemptId)) : null;
		if (source && source.state !== 'saved') throw new HttpError(409, 'conflict', 'Copy a saved attempt.');
		const document = source ? { ...source.document, approaches: source.document.approaches.map(approach => ({ ...approach, id: crypto.randomUUID() })) } : { notes: '', approaches: [newApproach()] };
		const newId = crypto.randomUUID();
		const result = await env.DB.prepare("INSERT INTO attempts (id,problem_id,state,document,search_text,acceptance,understanding,created_at,updated_at) VALUES (?,?,'draft',?,?,?,?,?,?) ON CONFLICT DO NOTHING")
			.bind(newId, problemId, JSON.stringify(document), attemptSearch(document), source?.acceptance ?? 'not_submitted', source?.understanding ?? 'needs_practice', now, now).run();
		if (!result.meta.changes) {
			const draft = await env.DB.prepare("SELECT id FROM attempts WHERE problem_id=? AND state='draft'").bind(problemId).first<{ id: string }>();
			throw new HttpError(409, 'draft_exists', 'Open the current draft before starting another attempt.', { attemptId: draft!.id });
		}
		return Response.json(await getAttempt(env, problemId, newId), { status: 201 });
	}
	if (match[3]) {
		const data = object(await readJson(request), ['version', 'nextReviewDate']);
		const results = await env.DB.batch([
			env.DB.prepare("UPDATE attempts SET state='saved',version=version+1,saved_at=?,updated_at=? WHERE id=? AND problem_id=? AND state='draft' AND version=?").bind(now, now, id, problemId, integer(data.version)),
			saveProgress(env, problemId, id, data, now),
		]);
		if (!results[0].meta.changes) await getAttempt(env, problemId, id);
		changed(results[0]);
		return Response.json(await getAttempt(env, problemId, id));
	}
	const data = object(await readJson(request, 272_384), ['version', 'document', 'acceptance', 'understanding']);
	const document = documentValue(data.document);
	const serialized = JSON.stringify(document);
	if (new TextEncoder().encode(serialized).byteLength > MAX_DOCUMENT_BYTES) throw new HttpError(413, 'too_large', 'Keep this attempt within 256,000 bytes.');
	const acceptance = choice(data.acceptance, ['not_submitted', 'not_accepted', 'accepted']);
	const understanding = choice(data.understanding, ['needs_practice', 'with_help', 'independent']);
	const row = await env.DB.prepare(`UPDATE attempts SET document=?,search_text=?,acceptance=?,understanding=?,version=version+1,updated_at=? WHERE id=? AND problem_id=? AND state='draft' AND version=? RETURNING ${attemptColumns},document`).bind(serialized, attemptSearch(document), acceptance, understanding, now, id, problemId, integer(data.version)).first<AttemptRow>();
	if (!row) { await getAttempt(env, problemId, id); throw new HttpError(409, 'conflict', 'This draft changed. Compare your work with the saved copy.'); }
	return Response.json(attemptValue(row));
}
