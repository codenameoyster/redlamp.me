import { waitUntil } from 'cloudflare:workers';
import type { Env } from '../index';
import type { AttemptDocument, SessionUser, TutorEvent, TutorKind, TutorMessage, TutorThread } from '../../shared/leetcode';
import { requireRole } from './auth';
import { accessToken, disconnected, unavailable, type Token } from './chatgpt';
import { choice, HttpError, methods, object, page, pagination, readJson, text, uuid } from './http';
import { getLesson } from './lessons';
import { getProblem, question } from './problems';
import { sets } from './sets';
import prompt from './tutor-prompt.txt';

const RESPONSES = 'https://api.openai.com/v1/responses';
const INTERRUPTED = { code: 'ai_interrupted', message: 'The answer stopped. Send your message again.' };
const THREADS = `SELECT context_kind AS kind,context_ref AS id,count(*) AS count,max(created_at) AS lastAt,
coalesce((SELECT title FROM problems WHERE id=context_ref AND context_kind='problem'),(SELECT title FROM lessons WHERE id=context_ref AND context_kind='lesson'),context_ref) AS title
FROM tutor_messages GROUP BY context_kind,context_ref ORDER BY lastAt DESC,kind,id LIMIT ? OFFSET ?`;
const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', '#39': "'", nbsp: ' ' };
type Upstream = { type?: string; delta?: string; code?: string | null; response?: { error?: { code?: string } | null } };
type Turn = Pick<TutorMessage, 'author' | 'body' | 'quote'>;

const clip = (value: string, max: number) => value.length > max ? `${value.slice(0, max)} [cut]` : value;
const said = (message: string, quote: string | null) => quote === null ? message : `Selected text:\n> ${quote}\n\n${message}`;
const squash = (value: string) => value.replace(/\s+/g, ' ').trim();
function findSet(slug: string) {
	const set = sets.find(item => item.slug === slug);
	if (!set) throw new HttpError(404, 'not_found', 'This set does not exist.');
	return set;
}
function thread(kind: unknown, id: unknown): [TutorKind, string] {
	const value = choice(kind, ['problem', 'set', 'lesson'] as const);
	return [value, value === 'set' ? text(id, 100) : uuid(id)];
}

// Plain text for the model only, so imperfect parsing is harmless. Code indentation stays.
export function htmlText(html: string): string {
	return html.replace(/<(script|style|template|svg)\b[\s\S]*?<\/\1\s*>/gi, '').replace(/<sup\b[^>]*>/gi, '^').replace(/<h([1-4])\b[^>]*>/gi, (_, level: string) => `\n${'#'.repeat(Number(level))} `)
		.replace(/<\/?(?:address|article|aside|blockquote|br|dd|details|div|dl|dt|figcaption|figure|footer|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|summary|table|td|th|tr|ul)\b[^>]*>/gi, '\n')
		.replace(/<[^>]*>/g, '').replace(/&(lt|gt|amp|quot|#39|nbsp);/g, (_, name: string) => ENTITIES[name])
		.replace(/(\S)[ \t]+/g, '$1 ').replace(/[ \t]+$/gm, '').replace(/\n+/g, '\n').trim();
}

// Whole h2 sections from the one that contains the quote, while they fit the budget.
function lessonText(html: string, quote: string | null): string {
	const value = htmlText(html), sections = value.split(/^(?=## )/m), needle = quote === null ? '' : squash(quote).slice(0, 80);
	const start = Math.max(0, sections.findIndex(section => squash(section).includes(needle)));
	let end = start + 1, size = sections[start].length;
	while (end < sections.length && size + sections[end].length <= 32_000) size += sections[end++].length;
	const outline = value.split('\n').filter(line => /^#{1,4} /.test(line)).join('\n');
	return `Lesson outline:\n${clip(outline, 3000)}\n\nLesson text (sections ${start + 1}-${end} of ${sections.length}).${start || end < sections.length ? ' The rest is cut.' : ''}\n${clip(sections.slice(start, end).join(''), 32_000)}`;
}

async function context(env: Env, kind: TutorKind, id: string, quote: string | null): Promise<string> {
	if (kind === 'set') {
		const set = findSet(id);
		return `${clip(`Learning set: ${set.title}\nSummary: ${set.summary}\nTopics: ${set.topics.join(', ')}\nTasks:\n${set.tasks.map(task => `${task.stage}: ${task.number}. ${task.title} (${task.difficulty}). ${task.note}`).join('\n')}`, 4000)}\n\n${lessonText(set.lesson, quote)}`;
	}
	if (kind === 'lesson') {
		const lesson = await getLesson(env, id), row = await env.DB.prepare('SELECT html FROM lesson_content WHERE lesson_id=?').bind(id).first<{ html: string }>();
		return `${clip(`Lesson: ${lesson.title}\nDescription: ${lesson.description}\nTopics: ${lesson.topics.join(', ')}`, 4000)}\n\n${lessonText(row!.html, quote)}`;
	}
	const problem = await getProblem(env, id);
	const [statement, task, attempt] = await Promise.all([
		question<{ content: string | null }>(problem.slug, 'content').then(value => value?.content, () => null), // Paid-only problems have no content.
		env.DB.prepare("SELECT h.title,h.instructions,h.due_date AS dueDate,t.state FROM homework_tasks t JOIN homework h ON h.id=t.homework_id WHERE t.problem_id=? AND t.state NOT IN ('completed','cancelled')").bind(id).first<{ title: string; instructions: string; dueDate: string | null; state: string }>(),
		env.DB.prepare('SELECT state,document FROM attempts WHERE problem_id=? ORDER BY state,saved_at DESC LIMIT 1').bind(id).first<{ state: string; document: string }>(),
	]);
	const parts = [clip([`Problem: ${problem.number === null ? '' : `${problem.number}. `}${problem.title} (${problem.difficulty})`, `Topics: ${problem.topics.join(', ')}`, `Summary: ${problem.summary}`, ...(task ? [`Homework: ${task.title}. State: ${task.state}. Due date: ${task.dueDate ?? 'none'}.`] : [])].join('\n'), 4000)];
	if (statement) parts.push(`LeetCode statement:\n${clip(htmlText(statement), 6000)}`);
	if (task) parts.push(`Homework instructions:\n${clip(task.instructions, 2000)}`);
	if (attempt) {
		const work = JSON.parse(attempt.document) as AttemptDocument;
		parts.push(`${attempt.state === 'draft' ? 'Current draft' : 'Newest saved attempt'}:\n${clip([`Notes: ${work.notes}`, ...work.approaches.map((a, i) => `Approach ${i + 1}: ${a.label}\nIdea: ${a.idea}\nWhy it works: ${a.correctness}\nTime complexity: ${a.timeComplexity}\nSpace complexity: ${a.spaceComplexity}\nEdge cases: ${a.edgeCases}\nMistakes: ${a.mistakes}\nLanguage: ${a.language}\nCode:\n${a.code}`)].join('\n\n'), 12_000)}`);
	}
	return parts.join('\n\n');
}

// One map for the JSON status before the stream and for the error event in the stream.
function failure(status: number, code: string): HttpError {
	if (status === 429 || code === 'subscription_sharing_usage_limit_exceeded') return new HttpError(429, 'ai_usage_limit', 'The ChatGPT plan has no AI usage left now. Try again later.');
	if (/^(?:subscription_sharing_user_not_eligible|subscription_sharing_v2_client_not_enabled|chatpass_v2_\w+)$/.test(code)) return new HttpError(403, 'ai_not_eligible', 'This ChatGPT plan cannot be used for the AI tutor.');
	if (code === 'model_not_found') return disconnected(); // A retired model: the parent connects again, which reads the model list again.
	if (!status || status >= 500 || code.endsWith('_unavailable')) return unavailable();
	return new HttpError(502, 'ai_failed', 'The AI tutor cannot answer now. Try again.');
}

export async function pump(upstream: Response, writer: WritableStreamDefaultWriter<string>, store: (answer: string) => Promise<unknown>): Promise<void> {
	let open = true, answer = '', completed = false, code = '', buffer = '';
	// A browser disconnect rejects the write. The pump keeps reading, so it can still store the turn.
	const send = async (event: TutorEvent) => { if (open) await writer.write(`data: ${JSON.stringify(event)}\n\n`).catch(() => { open = false; }); };
	try {
		for await (const chunk of upstream.body!.pipeThrough(new TextDecoderStream())) {
			const frames = (buffer + chunk).split(/\r?\n\r?\n/);
			buffer = frames.pop()!;
			for (const line of frames.flatMap(frame => frame.split(/\r?\n/))) {
				if (!line.startsWith('data:') || line.slice(5).trim() === '[DONE]') continue;
				const event = JSON.parse(line.slice(5)) as Upstream;
				if (event.type === 'response.output_text.delta' && event.delta) { answer += event.delta; await send({ delta: event.delta }); }
				else if (event.type === 'response.completed') completed = true;
				else if (event.type === 'response.failed' || event.type === 'response.incomplete' || event.type === 'error') code = event.response?.error?.code ?? event.code ?? '';
			}
		}
	} catch { /* A network error, the timeout or a frame that is not JSON ends the answer without response.completed. */ }
	try {
		if (completed) completed = await store(answer).then(() => true, () => false);
		if (completed) await send({ done: true });
		else {
			console.error('Tutor answer failed.', { code: code || 'interrupted', requestId: upstream.headers.get('x-request-id') });
			const error = code ? failure(200, code) : INTERRUPTED;
			await send({ error: { code: error.code, message: error.message } });
		}
	} finally { await writer.close().catch(() => {}); }
}

async function ask(request: Request, env: Env): Promise<Response> {
	const data = object(await readJson(request), ['kind', 'id', 'message', 'quote']);
	const [kind, id] = thread(data.kind, data.id), message = text(data.message, 4000, true), quote = data.quote === null ? null : text(data.quote, 2000, true), at = new Date().toISOString();
	const block = await context(env, kind, id, quote);
	const turns = (await env.DB.prepare('SELECT author,body,quote FROM tutor_messages WHERE context_kind=? AND context_ref=? ORDER BY created_at DESC,id DESC LIMIT 20').bind(kind, id).all<Turn>()).results;
	const history: { role: string; content: string }[] = [];
	let size = 0;
	for (const turn of turns) {
		const content = said(turn.body, turn.quote);
		if ((size += content.length) > 16_000) break;
		history.unshift({ role: turn.author === 'student' ? 'user' : 'assistant', content });
	}
	// The context has student and outside text, so it has the user role: the rules in instructions stay above it.
	const input = [...history, { role: 'user', content: `<context>\n${block}\n</context>` }, { role: 'user', content: said(message, quote) }];
	const call = (token: Token) => fetch(RESPONSES, { method: 'POST', headers: { Authorization: `Bearer ${token.access}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify({ model: token.model, instructions: prompt, input, stream: true, store: false }), signal: AbortSignal.timeout(180_000) }).catch(() => null);
	let token = await accessToken(env), response = await call(token);
	if (response?.status === 401) { token = await accessToken(env, token.version); response = await call(token); }
	if (response?.status !== 200) {
		const body = await response?.json<{ error?: { code?: unknown } }>().catch(() => null), code = typeof body?.error?.code === 'string' ? body.error.code : '';
		console.error('Tutor request failed.', { code: code || (response?.status ?? 'network'), requestId: response?.headers.get('x-request-id') ?? null });
		throw failure(response?.status ?? 0, code);
	}
	const insert = env.DB.prepare('INSERT INTO tutor_messages (id,context_kind,context_ref,author,body,quote,created_at) VALUES (?,?,?,?,?,?,?)');
	const { readable, writable } = new TextEncoderStream();
	waitUntil(pump(response, writable.getWriter(), answer => env.DB.batch([insert.bind(crypto.randomUUID(), kind, id, 'student', message, quote, at), insert.bind(crypto.randomUUID(), kind, id, 'assistant', answer, null, new Date().toISOString())])));
	return new Response(readable, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } });
}

export async function handleTutor(request: Request, env: Env, user: SessionUser): Promise<Response | null> {
	const url = new URL(request.url), match = /^\/leetcode\/api\/tutor\/(messages|threads)$/.exec(url.pathname);
	if (!match) return null;
	methods(request, match[1] === 'threads' ? ['GET'] : ['GET', 'POST']);
	if (request.method === 'POST') { requireRole(user, 'student'); return ask(request, env); }
	const { limit, offset } = pagination(url);
	if (match[1] === 'threads') {
		requireRole(user, 'parent');
		const rows = await env.DB.prepare(THREADS).bind(limit + 1, offset).all<TutorThread>();
		return Response.json(page(rows.results.map(row => row.kind === 'set' ? { ...row, title: sets.find(set => set.slug === row.id)?.title ?? row.id } : row), limit, offset));
	}
	const [kind, id] = thread(url.searchParams.get('kind'), url.searchParams.get('id'));
	if (kind === 'set') findSet(id); else await (kind === 'lesson' ? getLesson : getProblem)(env, id);
	const rows = await env.DB.prepare('SELECT id,author,body,quote,created_at AS createdAt FROM tutor_messages WHERE context_kind=? AND context_ref=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?').bind(kind, id, limit + 1, offset).all<TutorMessage>();
	return Response.json(page(rows.results, limit, offset));
}
