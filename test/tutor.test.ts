import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import prompt from '../src/leetcode/tutor-prompt.txt';
import { htmlText, pump } from '../src/leetcode/tutor';
import { login, request } from './client';

const TOKEN = 'https://auth.openai.com/api/accounts/oauth/token', MODELS = 'https://api.openai.com/v1/models', RESPONSES = 'https://api.openai.com/v1/responses', GRAPHQL = 'https://leetcode.com/graphql';
const PROBLEM = '11111111-1111-4111-8111-111111111111', LESSON = '22222222-2222-4222-8222-222222222222', SET = 'permutations-and-combinations', HOMEWORK = '77777777-7777-4777-8777-777777777777';
const LESSON_HTML = '<h1>Recursion</h1><p>A function calls itself.</p><h2>Base case</h2><p>Each circle is one call of backtrack.</p><h2>Depth</h2><p>The depth is the height of the tree.</p>';
const tokens = { access_token: 'access-1', refresh_token: 'refresh-1', token_type: 'Bearer', expires_in: 3600, scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct' };
const rotated = { access_token: 'access-2', refresh_token: 'refresh-2', token_type: 'Bearer', expires_in: 3600 };
const approach = { id: '33333333-3333-4333-8333-333333333333', label: 'Hash map', idea: 'Remember seen values.', correctness: 'Each pair is checked once.', timeComplexity: 'O(n)', spaceComplexity: 'O(n)', edgeCases: 'Empty input', mistakes: '', language: 'python' };
const USAGE_LIMIT = { code: 'ai_usage_limit', message: 'The ChatGPT plan has no AI usage left now. Try again later.' };
const INTERRUPTED = { code: 'ai_interrupted', message: 'The answer stopped. Send your message again.' };
const UNAVAILABLE = { code: 'ai_unavailable', message: 'ChatGPT is not available now. Try again in a few minutes.' };
type Reply = () => Response | Promise<Response>;
type Item = { role: string; content: string };

let student: string;
beforeEach(async () => {
	await env.DB.batch([
		env.DB.prepare("INSERT INTO problems (id,slug,number,title,difficulty,topics,summary,search_text,created_at,updated_at) VALUES (?,'two-sum',1,'Two Sum','easy','[\"Array\"]','Find two numbers.','','now','now')").bind(PROBLEM),
		env.DB.prepare("INSERT INTO lessons (id,title,description,topics,filename,byte_count,created_at,updated_at) VALUES (?,'Recursion','Calls that call themselves.','[\"Recursion\"]','recursion.html',1,'now','now')").bind(LESSON),
		env.DB.prepare('INSERT INTO lesson_content VALUES (?,?)').bind(LESSON, LESSON_HTML),
	]);
	const parent = await login('parent');
	const state = new URL((await (await request('/tutor/account/start', 'POST', undefined, parent)).json() as { url: string }).url).searchParams.get('state');
	upstream({ [TOKEN]: [() => Response.json(tokens)], [MODELS]: [() => Response.json({ models: [{ slug: 'gpt-6.1-sol', display_name: 'GPT-6.1 Sol', visibility: 'list' }] })] });
	expect((await request('/tutor/account/finish', 'POST', { address: `http://127.0.0.1:47319/auth/callback?code=c&state=${state}&client_id=oaiapp_x` }, parent)).status).toBe(200);
	vi.restoreAllMocks();
	student = await login('student');
});
afterEach(() => { vi.restoreAllMocks(); });

function upstream(replies: Record<string, Reply[]>) {
	return vi.spyOn(globalThis, 'fetch').mockImplementation(async target => {
		const reply = replies[String(target)]?.shift();
		if (!reply) throw new Error(`Unexpected request to ${target}.`);
		return reply();
	});
}
// Server-sent events with an event line and a data line, split into two chunks in the middle of a frame.
function sse(events: unknown[], type: string | null = 'text/event-stream') {
	const body = events.map(event => event === '[DONE]' ? 'data: [DONE]\n\n' : `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join(''), half = Math.floor(body.length / 2);
	const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(body.slice(0, half))); controller.enqueue(new TextEncoder().encode(body.slice(half))); controller.close(); } });
	return new Response(stream, { headers: { 'x-request-id': 'req_1', ...(type ? { 'Content-Type': type } : {}) } });
}
const delta = (text: string) => ({ type: 'response.output_text.delta', item_id: 'msg_1', output_index: 0, content_index: 0, delta: text });
const completed = { type: 'response.completed', response: { id: 'resp_1', status: 'completed' } };
const failed = (code: string) => ({ type: 'response.failed', response: { id: 'resp_1', status: 'failed', error: { code, message: 'Failed.' } } });
const openaiError = (status: number, code: string) => Response.json({ error: { message: 'Failed.', type: 'invalid_request_error', param: null, code } }, { status });
const answer = () => sse([delta('Hi'), completed]);
const send = (data: Record<string, unknown> = {}) => ({ kind: 'lesson', id: LESSON, message: 'Explain this part.', quote: null, ...data });
const events = async (response: Response) => (await response.text()).split('\n\n').filter(Boolean).map(frame => JSON.parse(frame.replace(/^data: /, '')));
const stored = async () => (await env.DB.prepare('SELECT context_kind AS kind,context_ref AS ref,author,body,quote FROM tutor_messages ORDER BY author DESC').all()).results;
const sent = (spy: ReturnType<typeof upstream>) => spy.mock.calls.filter(([target]) => String(target) === RESPONSES).map(([, init]) => JSON.parse(String(init?.body)) as { input: Item[] } & Record<string, unknown>);
const message = (kind: string, ref: string, author: string, body: string, quote: string | null, at: string) => env.DB.prepare('INSERT INTO tutor_messages VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(), kind, ref, author, body, quote, at);
const minute = (i: number) => new Date(Date.UTC(2026, 9, 9, 10, i)).toISOString();

it.each([
	{ name: 'parent cannot send', role: 'parent', method: 'POST', path: '/tutor/messages', body: send(), status: 403 },
	{ name: 'student reads a thread', role: 'student', method: 'GET', path: `/tutor/messages?kind=problem&id=${PROBLEM}`, status: 200 },
	{ name: 'parent reads a thread', role: 'parent', method: 'GET', path: `/tutor/messages?kind=problem&id=${PROBLEM}`, status: 200 },
	{ name: 'student lists threads', role: 'student', method: 'GET', path: '/tutor/threads', status: 403 },
	{ name: 'unknown problem', role: 'student', method: 'POST', path: '/tutor/messages', body: send({ kind: 'problem', id: crypto.randomUUID() }), status: 404 },
	{ name: 'unknown lesson', role: 'student', method: 'GET', path: `/tutor/messages?kind=lesson&id=${crypto.randomUUID()}`, status: 404 },
	{ name: 'unknown set', role: 'student', method: 'POST', path: '/tutor/messages', body: send({ kind: 'set', id: 'missing-set' }), status: 404 },
	{ name: 'unknown kind', role: 'student', method: 'POST', path: '/tutor/messages', body: send({ kind: 'homework' }), status: 400 },
	{ name: 'empty message', role: 'student', method: 'POST', path: '/tutor/messages', body: send({ message: ' ' }), status: 400 },
	{ name: 'message over 4000 characters', role: 'student', method: 'POST', path: '/tutor/messages', body: send({ message: 'm'.repeat(4001) }), status: 400 },
	{ name: 'quote over 2000 characters', role: 'student', method: 'POST', path: '/tutor/messages', body: send({ quote: 'q'.repeat(2001) }), status: 400 },
	{ name: 'extra field', role: 'student', method: 'POST', path: '/tutor/messages', body: send({ model: 'x' }), status: 400 },
] as { name: string; role: 'parent' | 'student'; method: string; path: string; body?: unknown; status: number }[])('$name', async ({ role, method, path, body, status }) => {
	await env.DB.batch([message('problem', PROBLEM, 'student', 'Why?', null, minute(0)), message('problem', PROBLEM, 'assistant', 'Look at the base case.', null, minute(1))]);
	const spy = upstream({});
	const response = await request(path, method, body, role === 'student' ? student : await login('parent'));
	expect(response.status).toBe(status);
	expect(await response.json()).toEqual(status === 200
		? { items: [{ id: expect.any(String), author: 'assistant', body: 'Look at the base case.', quote: null, createdAt: minute(1) }, { id: expect.any(String), author: 'student', body: 'Why?', quote: null, createdAt: minute(0) }], nextOffset: null }
		: { error: { code: expect.any(String), message: expect.any(String) } });
	expect(spy).not.toHaveBeenCalled();
	expect(await stored()).toHaveLength(2);
});

it.each([
	{ name: 'completed answer', reply: () => sse([delta('Hi '), delta('there'), completed]), received: [{ delta: 'Hi ' }, { delta: 'there' }, { done: true }], rows: [{ kind: 'lesson', ref: LESSON, author: 'student', body: 'Explain this part.', quote: 'Each circle is one call' }, { kind: 'lesson', ref: LESSON, author: 'assistant', body: 'Hi there', quote: null }] },
	{ name: 'usage limit after text', reply: () => sse([delta('Hi '), failed('subscription_sharing_usage_limit_exceeded')]), received: [{ delta: 'Hi ' }, { error: USAGE_LIMIT }], rows: [] },
	{ name: 'incomplete', reply: () => sse([delta('Hi '), { type: 'response.incomplete', response: { id: 'resp_1', status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } } }]), received: [{ delta: 'Hi ' }, { error: INTERRUPTED }], rows: [] },
	{ name: 'DONE without completed', reply: () => sse([delta('Hi '), '[DONE]']), received: [{ delta: 'Hi ' }, { error: INTERRUPTED }], rows: [] },
	{ name: 'error event', reply: () => sse([{ type: 'error', code: 'subscription_sharing_usage_unavailable', message: 'Failed.', param: null }]), received: [{ error: UNAVAILABLE }], rows: [] },
	{ name: 'stream with no content type', reply: () => sse([delta('Hi'), completed], null), received: [{ delta: 'Hi' }, { done: true }], rows: [{ kind: 'lesson', ref: LESSON, author: 'student', body: 'Explain this part.', quote: 'Each circle is one call' }, { kind: 'lesson', ref: LESSON, author: 'assistant', body: 'Hi', quote: null }] },
])('$name', async ({ reply, received, rows }) => {
	upstream({ [RESPONSES]: [reply] });
	const log = vi.spyOn(console, 'error').mockImplementation(() => {});
	const response = await request('/tutor/messages', 'POST', send({ quote: 'Each circle is one call' }), student);
	expect(response.status).toBe(200);
	expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
	expect(await events(response)).toEqual(received);
	expect(await stored()).toEqual(rows);
	expect(log.mock.calls).toEqual(rows.length ? [] : [['Tutor answer failed.', { code: expect.any(String), requestId: 'req_1' }]]);
});

it('stores the turn after the browser disconnects', async () => {
	const store = vi.fn(async () => {});
	await pump(sse([delta('Hi '), delta('there'), completed]), new WritableStream<string>({ write() { throw new TypeError('The browser disconnected.'); } }).getWriter(), store);
	expect(store).toHaveBeenCalledWith('Hi there');
});

it('sends the interrupted error when the store fails', async () => {
	const written: string[] = [], log = vi.spyOn(console, 'error').mockImplementation(() => {});
	await pump(sse([delta('a'), completed]), new WritableStream<string>({ write(chunk) { written.push(chunk); } }).getWriter(), async () => { throw new Error('D1 down'); });
	expect(written).toEqual([`data: ${JSON.stringify({ delta: 'a' })}\n\n`, `data: ${JSON.stringify({ error: INTERRUPTED })}\n\n`]);
	expect(log).toHaveBeenCalledOnce();
});

it.each([
	{ name: 'usage limit', replies: [() => openaiError(429, 'subscription_sharing_usage_limit_exceeded')], status: 429, code: 'ai_usage_limit', calls: [[RESPONSES, 'Bearer access-1']] },
	{ name: 'not eligible', replies: [() => openaiError(403, 'subscription_sharing_user_not_eligible')], status: 403, code: 'ai_not_eligible', calls: [[RESPONSES, 'Bearer access-1']] },
	{ name: 'client not enabled', replies: [() => openaiError(403, 'subscription_sharing_v2_client_not_enabled')], status: 403, code: 'ai_not_eligible', calls: [[RESPONSES, 'Bearer access-1']] },
	{ name: 'unavailable', replies: [() => openaiError(503, 'subscription_sharing_usage_unavailable')], status: 503, code: 'ai_unavailable', calls: [[RESPONSES, 'Bearer access-1']] },
	{ name: 'network error', replies: [() => { throw new TypeError('Network connection lost.'); }], status: 503, code: 'ai_unavailable', calls: [[RESPONSES, 'Bearer access-1']] },
	{ name: 'unsupported capability', replies: [() => openaiError(400, 'subscription_sharing_unsupported_capability')], status: 502, code: 'ai_failed', calls: [[RESPONSES, 'Bearer access-1']] },
	{ name: 'model not found', replies: [() => openaiError(404, 'model_not_found')], status: 409, code: 'ai_disconnected', calls: [[RESPONSES, 'Bearer access-1']] },
	{ name: 'region policy', replies: [() => Response.json({ detail: 'Unsupported country, region, or territory.' }, { status: 403 })], status: 502, code: 'ai_failed', calls: [[RESPONSES, 'Bearer access-1']] },
	{ name: '401 then success', replies: [() => openaiError(401, 'invalid_token'), answer], refresh: true, status: 200, code: null, calls: [[RESPONSES, 'Bearer access-1'], [TOKEN, null], [RESPONSES, 'Bearer access-2']] },
	{ name: '401 twice', replies: [() => openaiError(401, 'invalid_token'), () => openaiError(401, 'invalid_token')], refresh: true, status: 502, code: 'ai_failed', calls: [[RESPONSES, 'Bearer access-1'], [TOKEN, null], [RESPONSES, 'Bearer access-2']] },
	{ name: 'not connected', replies: [], disconnected: true, status: 409, code: 'ai_disconnected', calls: [] },
] as { name: string; replies: Reply[]; refresh?: boolean; disconnected?: boolean; status: number; code: string | null; calls: [string, string | null][] }[])('$name', async ({ replies, refresh, disconnected, status, code, calls }) => {
	if (disconnected) await env.DB.prepare('UPDATE tutor_account SET access_token=NULL,refresh_token=NULL,expires_at=NULL').run();
	const spy = upstream({ [RESPONSES]: [...replies], [TOKEN]: refresh ? [() => Response.json(rotated)] : [] });
	const response = await request('/tutor/messages', 'POST', send(), student);
	expect(response.status).toBe(status);
	if (code) expect(await response.json()).toEqual({ error: { code, message: expect.any(String) } });
	else expect(await events(response)).toEqual([{ delta: 'Hi' }, { done: true }]);
	expect(spy.mock.calls.map(([target, init]) => [String(target), (init?.headers as Record<string, string> | undefined)?.Authorization ?? null])).toEqual(calls);
	expect(await stored()).toHaveLength(code ? 0 : 2);
	expect(Boolean((await env.DB.prepare('SELECT refresh_token FROM tutor_account').first<{ refresh_token: string | null }>())!.refresh_token)).toBe(!disconnected);
});

it.each([
	{ name: 'fixed fields', history: 0, size: 2, quote: null, count: 0 },
	{ name: 'order', history: 2, size: 2, quote: null, historyQuote: 'A tree', count: 2 },
	{ name: 'quote format', history: 0, size: 2, quote: 'Each circle is one call', count: 0 },
	{ name: 'history limit', history: 30, size: 2, quote: null, count: 20 },
	{ name: 'history over the character budget', history: 3, size: 7000, quote: null, count: 2 },
] as { name: string; history: number; size: number; quote: string | null; historyQuote?: string; count: number }[])('$name', async ({ history, size, quote, historyQuote, count }) => {
	const seeded = Array.from({ length: history }, (_, i) => ({ author: i % 2 ? 'assistant' : 'student', body: `m${i}`.padEnd(size, '.'), quote: i ? null : historyQuote ?? null }));
	if (history) await env.DB.batch(seeded.map((item, i) => message('lesson', LESSON, item.author, item.body, item.quote, minute(i))));
	const spy = upstream({ [RESPONSES]: [answer] });
	const response = await request('/tutor/messages', 'POST', send({ quote }), student);
	await response.text();
	const [body] = sent(spy);
	expect(Object.keys(body).sort()).toEqual(['input', 'instructions', 'model', 'store', 'stream']);
	expect(body).toMatchObject({ model: 'gpt-6.1-sol', instructions: prompt, stream: true, store: false });
	expect(spy.mock.calls[0][1]?.headers).toEqual({ Authorization: 'Bearer access-1', 'Content-Type': 'application/json', Accept: 'text/event-stream' });
	expect(body.input).toEqual([
		...seeded.slice(history - count).map(item => ({ role: item.author === 'student' ? 'user' : 'assistant', content: item.quote ? `Selected text:\n> ${item.quote}\n\n${item.body}` : item.body })),
		{ role: 'user', content: expect.stringMatching(/^<context>\n[\s\S]*\n<\/context>$/) },
		{ role: 'user', content: quote ? `Selected text:\n> ${quote}\n\nExplain this part.` : 'Explain this part.' },
	]);
});

it.each([
	{ name: 'task instructions and code', kind: 'problem', task: true, work: [['draft', 'return seen', null]], statement: '<p>Given an array <code>nums</code>.</p>', includes: ['Problem: 1. Two Sum (easy)', 'LeetCode statement:\nGiven an array nums.', 'Homework instructions:\nUse a hash map.', 'Week 41', 'return seen'], excludes: [] },
	{ name: 'newest saved attempt', kind: 'problem', work: [['saved', 'old code', '2026-10-01T10:00:00.000Z'], ['saved', 'new code', '2026-10-02T10:00:00.000Z']], statement: '<p>Text</p>', includes: ['new code'], excludes: ['old code'] },
	{ name: 'draft before a newer saved attempt', kind: 'problem', work: [['draft', 'draft code', null], ['saved', 'saved code', '2026-10-02T10:00:00.000Z']], statement: '<p>Text</p>', includes: ['draft code'], excludes: ['saved code'] },
	{ name: 'statement fetch fails', kind: 'problem', statement: 500, includes: ['Problem: 1. Two Sum (easy)'], excludes: ['LeetCode statement'] },
	{ name: 'paid-only statement', kind: 'problem', statement: null, includes: ['Problem: 1. Two Sum (easy)'], excludes: ['LeetCode statement'] },
	{ name: 'field over its cap', kind: 'problem', work: [['draft', 'x'.repeat(13_000), null]], statement: null, includes: [/Current draft:\n[\s\S]{12000} \[cut\]\n<\/context>$/], excludes: [] },
	{ name: 'quote selects a section', kind: 'set', quote: 'A backtracking search builds an answer one decision at a time. Draw these decisions as a tree before you write code.', includes: ['Learning set: Permutations and combinations', /Lesson text \(sections 5-\d+ of 16\)\. The rest is cut\.\n## 3 The decision tree\n/], excludes: ['You make k independent choices.'] },
	{ name: 'set without a quote', kind: 'set', includes: ['Lesson text (sections 1-16 of 16).\n', 'Warm-up: 1863. Sum of All Subset XOR Totals (easy). Visit all 2^n subsets'], excludes: ['The rest is cut'] },
	{ name: 'lesson', kind: 'lesson', includes: ['Lesson: Recursion', 'Lesson outline:\n# Recursion\n## Base case\n## Depth', 'Lesson text (sections 1-3 of 3).\n# Recursion\nA function calls itself.'], excludes: ['The rest is cut'] },
	{ name: 'lesson quote from section 2', kind: 'lesson', quote: 'Each  circle is\none call', includes: ['Lesson text (sections 2-3 of 3). The rest is cut.\n## Base case'], excludes: ['A function calls itself.'] },
] as { name: string; kind: string; task?: boolean; work?: [string, string, string | null][]; statement?: string | number | null; quote?: string; includes: (string | RegExp)[]; excludes: string[] }[])('$name', async ({ kind, task, work, statement, quote, includes, excludes }) => {
	if (task) await env.DB.batch([
		env.DB.prepare("INSERT INTO homework (id,title,instructions,due_date,created_at,updated_at) VALUES (?,'Week 41','Use a hash map.','2026-10-12','now','now')").bind(HOMEWORK),
		env.DB.prepare("INSERT INTO homework_tasks (id,homework_id,problem_id,state,created_at,updated_at) VALUES (?,?,?,'in_progress','now','now')").bind(crypto.randomUUID(), HOMEWORK, PROBLEM),
	]);
	for (const [state, code, savedAt] of work ?? []) await env.DB.prepare("INSERT INTO attempts (id,problem_id,state,document,search_text,acceptance,understanding,created_at,updated_at,saved_at) VALUES (?,?,?,?,'','not_submitted','needs_practice','now','now',?)")
		.bind(crypto.randomUUID(), PROBLEM, state, JSON.stringify({ notes: 'My notes', approaches: [{ ...approach, code }] }), savedAt).run();
	const spy = upstream({ [RESPONSES]: [answer], [GRAPHQL]: kind === 'problem' ? [() => typeof statement === 'number' ? new Response('Busy', { status: statement }) : Response.json({ data: { question: { content: statement } } })] : [] });
	const response = await request('/tutor/messages', 'POST', send({ kind, id: { problem: PROBLEM, set: SET, lesson: LESSON }[kind], quote: quote ?? null }), student);
	expect(response.status).toBe(200);
	expect(await events(response)).toEqual([{ delta: 'Hi' }, { done: true }]);
	if (kind === 'problem') expect(JSON.parse(String(spy.mock.calls[0][1]?.body))).toMatchObject({ variables: { titleSlug: 'two-sum' }, query: expect.stringContaining('content') });
	const context = sent(spy)[0].input.at(-2)!.content;
	for (const pattern of includes) expect(context).toMatch(pattern);
	for (const text of excludes) expect(context).not.toContain(text);
});

it.each([
	{ name: 'script removed', html: '<p>a</p><script>x()</script>', expected: 'a' },
	{ name: 'sup becomes caret', html: '10<sup>4</sup>', expected: '10^4' },
	{ name: 'entities decoded', html: 'a &lt; b &amp;&amp; c', expected: 'a < b && c' },
	{ name: 'heading marked', html: '<h2>Base case</h2>', expected: '## Base case' },
	{ name: 'code indentation kept', html: '<pre>if x:\n    y</pre>', expected: 'if x:\n    y' },
])('$name', ({ html, expected }) => { expect(htmlText(html)).toBe(expected); });

it.each([
	{ name: 'newest first', messages: [['problem', PROBLEM, minute(0)], ['set', SET, minute(60)]], expected: [{ kind: 'set', id: SET, title: 'Permutations and combinations', count: 1, lastAt: minute(60) }, { kind: 'problem', id: PROBLEM, title: 'Two Sum', count: 1, lastAt: minute(0) }] },
	{ name: 'titles', messages: [['problem', PROBLEM, minute(2)], ['lesson', LESSON, minute(1)], ['set', SET, minute(0)]], expected: [{ kind: 'problem', id: PROBLEM, title: 'Two Sum', count: 1, lastAt: minute(2) }, { kind: 'lesson', id: LESSON, title: 'Recursion', count: 1, lastAt: minute(1) }, { kind: 'set', id: SET, title: 'Permutations and combinations', count: 1, lastAt: minute(0) }] },
	{ name: 'count', messages: [0, 1, 2, 3].map(i => ['lesson', LESSON, minute(i)]), expected: [{ kind: 'lesson', id: LESSON, title: 'Recursion', count: 4, lastAt: minute(3) }] },
])('$name', async ({ messages, expected }) => {
	await env.DB.batch(messages.map(([kind, ref, at]) => message(kind, ref, 'student', 'Why?', null, at)));
	const response = await request('/tutor/threads', 'GET', undefined, await login('parent'));
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ items: expected, nextOffset: null });
});
