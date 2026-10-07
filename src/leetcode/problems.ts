import type { Env } from '../index';
import type { Difficulty, Problem, ProblemDetails, ProblemInput } from '../../shared/leetcode';
import { calendarDate, changed, choice, HttpError, integer, methods, object, page, pagination, readJson, text, topics, uuid } from './http';

export const solvedSQL = "EXISTS(SELECT 1 FROM attempts a WHERE a.problem_id=p.id AND a.state='saved' AND a.acceptance='accepted')";
export const problemColumns = `p.id,p.slug,p.number,p.title,p.difficulty,p.topics,p.summary,p.version,p.progress_version AS progressVersion,p.understanding,
p.next_review_date AS nextReviewDate,p.archived_at AS archivedAt,p.created_at AS createdAt,p.updated_at AS updatedAt,${solvedSQL} AS solved`;
type ProblemRow = Omit<Problem, 'topics' | 'url' | 'solved'> & { topics: string; solved: number };
export function problemValue(row: ProblemRow): Problem { return { ...row, topics: JSON.parse(row.topics), solved: Boolean(row.solved), url: `https://leetcode.com/problems/${row.slug}/` }; }
export function searchText(value: string): string { return value.normalize('NFC').toLowerCase(); }

export async function getProblem(env: Env, id: string): Promise<Problem> {
	const row = await env.DB.prepare(`SELECT ${problemColumns} FROM problems p WHERE p.id=?`).bind(uuid(id)).first<ProblemRow>();
	if (!row) throw new HttpError(404, 'not_found', 'This problem does not exist.');
	return problemValue(row);
}

function slug(value: unknown): string {
	let url: URL;
	try { url = new URL(text(value, 2000, true)); } catch { throw new HttpError(400, 'invalid_url', 'Use a LeetCode problem URL.'); }
	const match = /^\/problems\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/|$)/.exec(url.pathname);
	if (url.protocol !== 'https:' || url.hostname !== 'leetcode.com' || url.port || url.username || url.password || !match) throw new HttpError(400, 'invalid_url', 'Use a LeetCode problem URL.');
	return match[1];
}

function metadata(data: Record<string, unknown>): ProblemInput & { slug: string } {
	const value = slug(data.url);
	return { slug: value, url: `https://leetcode.com/problems/${value}/`, number: data.number === null ? null : integer(data.number), title: text(data.title, 200, true).trim(), difficulty: choice(data.difficulty, ['easy', 'medium', 'hard']), topics: topics(data.topics), summary: text(data.summary, 8000).trim() };
}

type Question = { questionFrontendId: string; title: string; difficulty: string; topicTags: { name: string }[] } | null;
async function details(titleSlug: string): Promise<ProblemDetails> {
	let question: Question;
	try {
		const response = await fetch('https://leetcode.com/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json', Referer: `https://leetcode.com/problems/${titleSlug}/` }, body: JSON.stringify({ query: 'query question($titleSlug: String!) { question(titleSlug: $titleSlug) { questionFrontendId title difficulty topicTags { name } } }', variables: { titleSlug } }) });
		if (!response.ok) throw new Error(`LeetCode returned ${response.status}.`);
		question = (await response.json() as { data: { question: Question } }).data.question;
	} catch { throw new HttpError(502, 'lookup_failed', 'LeetCode details are unavailable. Enter them yourself.'); }
	if (!question) throw new HttpError(404, 'not_found', 'LeetCode has no problem at this URL.');
	return { number: /^\d+$/.test(question.questionFrontendId) ? Number(question.questionFrontendId) : null, title: question.title, difficulty: question.difficulty.toLowerCase() as Difficulty, topics: question.topicTags.slice(0, 12).map(tag => tag.name) };
}

export async function handleProblems(request: Request, env: Env): Promise<Response | null> {
	const url = new URL(request.url);
	if (url.pathname === '/leetcode/api/problem-details') { methods(request, ['GET']); return Response.json(await details(slug(url.searchParams.get('url')))); }
	const match = /^\/leetcode\/api\/problems(?:\/([^/]+)(?:\/(archive|restore))?)?$/.exec(url.pathname);
	if (!match) return null;
	const id = match[1] ? uuid(match[1]) : null;
	methods(request, id ? match[2] ? ['POST'] : ['GET', 'PATCH'] : ['GET', 'POST']);
	if (request.method === 'GET') {
		if (id) return Response.json(await getProblem(env, id));
		const { limit, offset } = pagination(url);
		const q = searchText(text(url.searchParams.get('q') ?? '', 100));
		const where = [url.searchParams.get('archived') === '1' ? 'p.archived_at IS NOT NULL' : 'p.archived_at IS NULL'];
		const args: (string | number | null)[] = [];
		if (q) { where.push('(instr(p.search_text,?)>0 OR EXISTS(SELECT 1 FROM attempts a WHERE a.problem_id=p.id AND instr(a.search_text,?)>0))'); args.push(q, q); }
		if (url.searchParams.has('difficulty')) { where.push('p.difficulty=?'); args.push(choice(url.searchParams.get('difficulty'), ['easy', 'medium', 'hard'])); }
		if (url.searchParams.has('understanding')) { where.push('p.understanding=?'); args.push(choice(url.searchParams.get('understanding'), ['needs_practice', 'with_help', 'independent'])); }
		if (url.searchParams.has('topic')) { where.push('EXISTS(SELECT 1 FROM json_each(p.topics) WHERE value=?)'); args.push(text(url.searchParams.get('topic'), 40, true)); }
		if (url.searchParams.has('solved')) { where.push(`${solvedSQL}=?`); args.push(Number(choice(url.searchParams.get('solved'), ['0', '1']))); }
		if (url.searchParams.has('homework')) { where.push("EXISTS(SELECT 1 FROM homework h WHERE h.problem_id=p.id AND h.state NOT IN ('completed','cancelled'))=?"); args.push(Number(choice(url.searchParams.get('homework'), ['0', '1']))); }
		if (url.searchParams.has('due')) { where.push('p.next_review_date<=?'); args.push(calendarDate(url.searchParams.get('due'))); }
		const rows = await env.DB.prepare(`SELECT ${problemColumns} FROM problems p WHERE ${where.join(' AND ')} ORDER BY p.updated_at DESC,p.id LIMIT ? OFFSET ?`).bind(...args, limit + 1, offset).all<ProblemRow>();
		return Response.json(page(rows.results.map(problemValue), limit, offset));
	}
	const data = object(await readJson(request), match[2] ? ['version'] : ['url', 'number', 'title', 'difficulty', 'topics', 'summary', ...(id ? ['version'] : [])]);
	const now = new Date().toISOString();
	if (id) await getProblem(env, id);
	if (match[2] === 'restore') {
		changed(await env.DB.prepare('UPDATE problems SET archived_at=NULL,version=version+1,updated_at=? WHERE id=? AND version=?').bind(now, id, integer(data.version)).run());
		return Response.json(await getProblem(env, id!));
	}
	if (match[2]) {
		const result = await env.DB.prepare("UPDATE problems SET archived_at=?,version=version+1,updated_at=? WHERE id=? AND version=? AND NOT EXISTS(SELECT 1 FROM homework WHERE problem_id=? AND state NOT IN ('completed','cancelled'))").bind(now, now, id, integer(data.version), id).run();
		if (!result.meta.changes && await env.DB.prepare("SELECT 1 FROM homework WHERE problem_id=? AND state NOT IN ('completed','cancelled')").bind(id).first()) throw new HttpError(409, 'active_homework', 'Complete or cancel the active homework before you archive this problem.');
		changed(result);
		return Response.json(await getProblem(env, id!));
	}
	const value = metadata(data);
	const search = searchText([value.title, value.number, ...value.topics, value.summary].join(' '));
	if (id) {
		const duplicate = await env.DB.prepare('SELECT id FROM problems WHERE slug=? AND id<>?').bind(value.slug, id).first();
		if (duplicate) throw new HttpError(409, 'duplicate_problem', 'That problem already has a notebook.');
		changed(await env.DB.prepare('UPDATE problems SET slug=?,number=?,title=?,difficulty=?,topics=?,summary=?,search_text=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(value.slug, value.number, value.title, value.difficulty, JSON.stringify(value.topics), value.summary, search, now, id, integer(data.version)).run());
		return Response.json(await getProblem(env, id));
	}
	const newId = crypto.randomUUID();
	const result = await env.DB.prepare('INSERT INTO problems (id,slug,number,title,difficulty,topics,summary,search_text,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(slug) DO NOTHING').bind(newId, value.slug, value.number, value.title, value.difficulty, JSON.stringify(value.topics), value.summary, search, now, now).run();
	const row = await env.DB.prepare('SELECT id FROM problems WHERE slug=?').bind(value.slug).first<{ id: string }>();
	return Response.json(await getProblem(env, row!.id), { status: result.meta.changes ? 201 : 200 });
}
