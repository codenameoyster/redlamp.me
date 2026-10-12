import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { login, request } from './client';
import type { ProblemTests } from '../shared/leetcode';
import { sets, taskSlug, tasksOf } from '../src/leetcode/sets';

let cookie: string;
beforeEach(async () => { cookie = await login(); });
afterEach(() => { vi.restoreAllMocks(); });
const insertProblem = env.DB.prepare("INSERT INTO problems (id,slug,title,difficulty,topics,summary,search_text,created_at,updated_at) VALUES (?,?,'Problem','medium','[]','','','now','now')");

// The fixtures copy the shapes of the LeetCode GraphQL answers: <pre> examples (two-sum), <span class="example-io"> examples (valid-parentheses), content and code snippets of null (a paid-only problem).
const snippets = [{ langSlug: 'cpp', code: 'class Solution {\n};' }, { langSlug: 'python', code: 'class Solution(object):\n    def solve(self):\n        ' }, { langSlug: 'python3', code: 'class Solution:\n    def solve(self) -> int:\n        ' }];
const leetcode = (metaData: object, exampleTestcaseList: string[], content: string | null, codeSnippets: object[] | null = snippets) => () => Response.json({ data: { question: { metaData: JSON.stringify(metaData), exampleTestcaseList, content, codeSnippets } } });
const pre = (output: string) => `<pre>\n<strong>Input:</strong> value\n<strong>Output:</strong> ${output}\n<strong>Explanation:</strong> Output: text.\n</pre>`;
const span = (output: string) => `<p><strong>Input:</strong> <span class="example-io">value</span></p>\n<p><strong>Output: </strong><span class="example-io" style="font-family: Menlo,sans-serif;">${output}</span></p>`;
const twoSum = { name: 'twoSum', params: [{ name: 'nums', type: 'integer[]' }, { name: 'target', type: 'integer' }], return: { type: 'integer[]', size: 2 }, manual: false };
const snippet = snippets[2].code, stdin = 'import sys\ninput = sys.stdin.readline\n\ndef main():\n    # Прочитайте входные данные и выведите ответ.\n    pass\n\nmain()\n', fallback = 'class Solution:\n    pass';
const noRunner = { spec: null, source: 'none', standard: [], own: [], skeleton: '' };
it.each([
	{ name: 'LeetCode task of a set', slug: 'two-sum-ii-input-array-is-sorted', reply: leetcode(twoSum, ['[2,7,11,15]\n9'], pre('[0,1]')), body: { spec: { mode: 'call', method: 'twoSum' }, source: 'set', standard: expect.arrayContaining([{ input: '[[2,7,11,15],9]', expected: '[1,2]' }]), own: [], skeleton: snippet } },
	{ name: 'LeetCode task of a set with unreachable LeetCode', slug: 'two-sum-ii-input-array-is-sorted', reply: () => { throw new TypeError('Network connection lost.'); }, body: { spec: { mode: 'call', method: 'twoSum' }, source: 'set', standard: expect.arrayContaining([{ input: '[[2,7,11,15],9]', expected: '[1,2]' }]), own: [], skeleton: fallback } },
	{ name: 'Codeforces task of a set', slug: 'cf-1821-a', reply: null, body: { spec: { mode: 'stdio' }, source: 'set', standard: expect.arrayContaining([{ input: '8\n??\n?\n0\n9\n03\n1??7\n?5?\n9??99\n', expected: '90\n9\n0\n1\n0\n100\n90\n100\n' }]), own: [], skeleton: stdin } },
	{ name: 'Codeforces problem outside the sets', slug: 'cf-1-a', reply: null, body: { spec: { mode: 'stdio' }, source: 'none', standard: [], own: [], skeleton: stdin } },
	{ name: 'LeetCode examples with two outputs', slug: 'two-sum', reply: leetcode(twoSum, ['[2,7,11,15]\n9', '[3,3]\n6'], `${pre('[0,1]')}\n${pre('[0,1]')}`), body: { spec: { mode: 'call', method: 'twoSum' }, source: 'leetcode', standard: [{ input: '[[2,7,11,15],9]', expected: '[0,1]' }, { input: '[[3,3],6]', expected: '[0,1]' }], own: [], skeleton: snippet } },
	{ name: 'LeetCode in-place examples', slug: 'rotate-array', reply: leetcode({ name: 'rotate', params: [{ name: 'nums', type: 'integer[]' }, { name: 'k', type: 'integer' }], return: { type: 'void' }, output: { paramindex: 0 } }, ['[1,2,3,4,5,6,7]\n3', '[-1,-100,3,99]\n2'], `${pre('[5,6,7,1,2,3,4]')}\n${pre('[3,99,-1,-100]')}`), body: { spec: { mode: 'call', method: 'rotate', check: 'arg0' }, source: 'leetcode', standard: [{ input: '[[1,2,3,4,5,6,7],3]', expected: '[5,6,7,1,2,3,4]' }, { input: '[[-1,-100,3,99],2]', expected: '[3,99,-1,-100]' }], own: [], skeleton: snippet } },
	{ name: 'LeetCode boolean examples', slug: 'kids-with-the-greatest-number-of-candies', reply: leetcode({ name: 'kidsWithCandies', params: [{ name: 'candies', type: 'integer[]' }, { name: 'extraCandies', type: 'integer' }], return: { type: 'list<boolean>' } }, ['[2,3,5,1,3]\n3', '[12,1,12]\n10'], `${span('[true,true,true,false,true]')}\n${span('[true,false,true]')}`), body: { spec: { mode: 'call', method: 'kidsWithCandies' }, source: 'leetcode', standard: [{ input: '[[2,3,5,1,3],3]', expected: '[True,True,True,False,True]' }, { input: '[[12,1,12],10]', expected: '[True,False,True]' }], own: [], skeleton: snippet } },
	{ name: 'LeetCode string examples', slug: 'longest-palindromic-substring', reply: leetcode({ name: 'longestPalindrome', params: [{ name: 's', type: 'string' }], return: { type: 'string' } }, ['"babad"', '"true"'], `${pre('&quot;bab&quot;')}\n${pre('&quot;t&quot;')}`), body: { spec: { mode: 'call', method: 'longestPalindrome' }, source: 'leetcode', standard: [{ input: '["babad"]', expected: '"bab"' }, { input: '["true"]', expected: '"t"' }], own: [], skeleton: snippet } },
	{ name: 'LeetCode problem without a Python 3 snippet', slug: 'two-sum', reply: leetcode(twoSum, ['[3,3]\n6'], pre('[0,1]'), snippets.slice(0, 2)), body: { spec: { mode: 'call', method: 'twoSum' }, source: 'leetcode', standard: [{ input: '[[3,3],6]', expected: '[0,1]' }], own: [], skeleton: fallback } },
	{ name: 'LeetCode examples with a missing output', slug: 'two-sum', reply: leetcode(twoSum, ['[2,7,11,15]\n9', '[3,3]\n6'], pre('[0,1]')), body: { spec: { mode: 'call', method: 'twoSum' }, source: 'leetcode', standard: [{ input: '[[2,7,11,15],9]', expected: null }, { input: '[[3,3],6]', expected: null }], own: [], skeleton: snippet } },
	{ name: 'paid-only LeetCode problem', slug: 'meeting-rooms', reply: leetcode({ name: 'canAttendMeetings', params: [{ name: 'intervals', type: 'integer[][]' }], return: { type: 'boolean' } }, ['[[0,30],[5,10],[15,20]]', '[[7,10],[2,4]]'], null, null), body: { spec: { mode: 'call', method: 'canAttendMeetings' }, source: 'leetcode', standard: [{ input: '[[[0,30],[5,10],[15,20]]]', expected: null }, { input: '[[[7,10],[2,4]]]', expected: null }], own: [], skeleton: fallback } },
	{ name: 'LeetCode tree problem', slug: 'binary-tree-inorder-traversal', reply: leetcode({ name: 'inorderTraversal', params: [{ name: 'root', type: 'TreeNode' }], return: { type: 'list<integer>', dealloc: true } }, ['[1,null,2,3]'], span('[1,3,2]')), body: { ...noRunner, skeleton: snippet } },
	{ name: 'LeetCode interactive problem', slug: 'first-bad-version', reply: leetcode({ name: 'firstBadVersion', params: [{ name: 'n', type: 'integer' }, { name: 'bad', type: 'integer' }], return: { type: 'integer' }, manual: true }, ['5\n4', '1\n1'], `${pre('4')}\n${pre('1')}`), body: { ...noRunner, skeleton: snippet } },
	{ name: 'LeetCode design problem', slug: 'lru-cache', reply: leetcode({ classname: 'LRUCache', constructor: { params: [{ type: 'integer', name: 'capacity' }] }, methods: [{ name: 'get', params: [{ type: 'integer', name: 'key' }], return: { type: 'integer' } }], systemdesign: true }, ['["LRUCache","get"]\n[[2],[1]]'], '<pre>\n<strong>Output</strong>\n[null, -1]\n</pre>'), body: { ...noRunner, skeleton: snippet } },
	{ name: 'unknown LeetCode problem', slug: 'two-sum', reply: () => Response.json({ data: { question: null } }), body: noRunner },
	{ name: 'LeetCode error response', slug: 'two-sum', reply: () => new Response('Busy', { status: 503 }), body: noRunner },
	{ name: 'unreachable LeetCode', slug: 'two-sum', reply: () => { throw new TypeError('Network connection lost.'); }, body: noRunner },
	{ name: 'LeetCode without an answer', slug: 'two-sum', reply: (init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason))), body: noRunner },
])('$name', async ({ slug, reply, body }) => {
	// A short timeout keeps the test fast.
	const timeout = AbortSignal.timeout.bind(AbortSignal);
	vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => timeout(10));
	const lookup = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_, init) => reply!(init));
	const id = crypto.randomUUID();
	await insertProblem.bind(id, slug).run();
	const response = await request(`/problems/${id}/tests`, 'GET', undefined, cookie);
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual(body);
	// One request asks for the examples and the code snippets.
	expect(lookup.mock.calls.map(([target, init]) => { const { query, variables } = JSON.parse(String(init?.body)); return [String(target), variables.titleSlug, query.includes('codeSnippets { langSlug code }')]; })).toEqual(reply ? [['https://leetcode.com/graphql', slug, true]] : []);
});

const statement = (slug: string) => sets.flatMap(tasksOf).find(task => taskSlug(task) === slug)!.statement;
const content = '<p>Find <code>nums[i] + nums[j] == target</code>.</p>\n<pre>\n<strong>Input:</strong> nums = [3,3], target = 6\n</pre>\n<ul><li><code>2 &lt;= nums.length</code></li></ul>';
it.each([
	{ name: 'statement of a LeetCode task of a set', slug: 'two-sum-ii-input-array-is-sorted', reply: null, body: { html: statement('two-sum-ii-input-array-is-sorted'), text: null } },
	{ name: 'statement of a Codeforces task of a set', slug: 'cf-1821-a', reply: null, body: { html: statement('cf-1821-a'), text: null } },
	{ name: 'statement of a Codeforces problem outside the sets', slug: 'cf-1-a', reply: null, body: { html: null, text: null } },
	{ name: 'statement of a LeetCode problem outside the sets', slug: 'two-sum', reply: () => Response.json({ data: { question: { content } } }), body: { html: null, text: 'Find nums[i] + nums[j] == target.\nInput: nums = [3,3], target = 6\n2 <= nums.length' } },
	{ name: 'statement of a paid-only LeetCode problem', slug: 'meeting-rooms', reply: () => Response.json({ data: { question: { content: null } } }), body: { html: null, text: null } },
	{ name: 'statement of an unknown LeetCode problem', slug: 'two-sum', reply: () => Response.json({ data: { question: null } }), body: { html: null, text: null } },
	{ name: 'statement with a LeetCode error response', slug: 'two-sum', reply: () => new Response('Busy', { status: 503 }), body: { html: null, text: null } },
	{ name: 'statement with unreachable LeetCode', slug: 'two-sum', reply: () => { throw new TypeError('Network connection lost.'); }, body: { html: null, text: null } },
])('$name', async ({ slug, reply, body }) => {
	const lookup = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => reply!());
	const id = crypto.randomUUID();
	await insertProblem.bind(id, slug).run();
	const response = await request(`/problems/${id}/statement`, 'GET', undefined, cookie);
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual(body);
	expect(lookup.mock.calls.map(([target, init]) => [String(target), JSON.parse(String(init?.body)).variables.titleSlug])).toEqual(reply ? [['https://leetcode.com/graphql', slug]] : []);
});

it.each([
	{ name: 'unknown problem', path: 'tests', method: 'GET', status: 404 },
	{ name: 'own test of an unknown problem', path: 'tests', method: 'POST', status: 404 },
	{ name: 'change of the standard tests', path: 'tests', method: 'PUT', status: 405 },
	{ name: 'statement of an unknown problem', path: 'statement', method: 'GET', status: 404 },
	{ name: 'change of the statement', path: 'statement', method: 'PUT', status: 405 },
])('$name', async ({ path, method, status }) => {
	expect((await request(`/problems/${crypto.randomUUID()}/${path}`, method, method === 'GET' ? undefined : {}, cookie)).status).toBe(status);
});

const ownTest = { input: '[[3, 3], 6]', expected: '[0, 1]' };
const insertOwn = env.DB.prepare("INSERT INTO problem_tests (id,problem_id,input,expected,created_at) VALUES (?,?,'1','1','2026-10-01T10:00:00.000Z')");
it.each([
	{ name: 'student adds an own test', role: 'student', stored: 0, body: ownTest, status: 201, count: 1, fields: ownTest },
	{ name: 'parent adds an own test', role: 'parent', stored: 0, body: ownTest, status: 201, count: 1, fields: ownTest },
	{ name: 'twentieth own test', role: 'student', stored: 19, body: ownTest, status: 201, count: 20, fields: ownTest },
	{ name: 'twenty-first own test', role: 'student', stored: 20, body: ownTest, status: 409, count: 20, fields: { error: { code: 'too_many_tests' } } },
	{ name: 'input at 10,000 characters', role: 'student', stored: 0, body: { input: '1'.repeat(10_000), expected: '1' }, status: 201, count: 1, fields: { input: '1'.repeat(10_000) } },
	{ name: 'input over 10,000 characters', role: 'student', stored: 0, body: { input: '1'.repeat(10_001), expected: '1' }, status: 400, count: 0, fields: { error: { code: 'invalid_input' } } },
	{ name: 'expected over 10,000 characters', role: 'student', stored: 0, body: { input: '1', expected: '1'.repeat(10_001) }, status: 400, count: 0, fields: { error: { code: 'invalid_input' } } },
	{ name: 'blank input', role: 'student', stored: 0, body: { input: ' \n', expected: '1' }, status: 400, count: 0, fields: { error: { code: 'invalid_input' } } },
	{ name: 'blank expected', role: 'student', stored: 0, body: { input: '1', expected: ' ' }, status: 400, count: 0, fields: { error: { code: 'invalid_input' } } },
	{ name: 'expected of null', role: 'student', stored: 0, body: { input: '1', expected: null }, status: 400, count: 0, fields: { error: { code: 'invalid_input' } } },
	{ name: 'unknown field', role: 'student', stored: 0, body: { ...ownTest, name: 'Test' }, status: 400, count: 0, fields: { error: { code: 'invalid_input' } } },
])('$name', async ({ role, stored, body, status, count, fields }) => {
	vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ data: { question: null } }));
	const id = crypto.randomUUID();
	await insertProblem.bind(id, 'two-sum').run();
	for (let index = 0; index < stored; index++) await insertOwn.bind(crypto.randomUUID(), id).run();
	const response = await request(`/problems/${id}/tests`, 'POST', body, role === 'parent' ? await login('parent') : cookie);
	expect(response.status).toBe(status);
	const created = await response.json();
	expect(created).toMatchObject(fields);
	expect(await env.DB.prepare('SELECT count(*) AS count FROM problem_tests').first()).toEqual({ count });
	// The runner numbers the own tests after the standard tests in the order of creation.
	if (status === 201) expect((await (await request(`/problems/${id}/tests`, 'GET', undefined, cookie)).json() as ProblemTests).own.at(-1)).toEqual(created);
});

it.each([
	{ name: 'delete an own test', owner: 'same', target: 'stored', status: 204, count: 0 },
	{ name: 'delete an own test of another problem', owner: 'other', target: 'stored', status: 404, count: 1 },
	{ name: 'delete an unknown own test', owner: 'same', target: 'unknown', status: 404, count: 1 },
])('$name', async ({ owner, target, status, count }) => {
	const id = crypto.randomUUID(), other = crypto.randomUUID(), stored = crypto.randomUUID();
	await env.DB.batch([insertProblem.bind(id, 'two-sum'), insertProblem.bind(other, 'cf-1-a'), insertOwn.bind(stored, id)]);
	const response = await request(`/problems/${owner === 'same' ? id : other}/tests/${target === 'stored' ? stored : crypto.randomUUID()}`, 'DELETE', undefined, cookie);
	expect(response.status).toBe(status);
	expect(await env.DB.prepare('SELECT count(*) AS count FROM problem_tests').first()).toEqual({ count });
});

// SHA-256 of "abc".
const abc = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', other = 'f'.repeat(64);
const [x, y, z] = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];
const insertAttempt = env.DB.prepare("INSERT INTO attempts (id,problem_id,state,document,search_text,acceptance,understanding,saved_at,created_at,updated_at) VALUES (?,?,?,?,'','not_submitted','needs_practice',NULL,?,'now')");
const runDocument = JSON.stringify({ notes: '', approaches: [x, y].map(id => ({ id, label: '', idea: '', correctness: '', timeComplexity: '', spaceComplexity: '', edgeCases: '', mistakes: '', language: 'Python', code: 'abc' })) });
const runBody = { approachId: x, codeHash: abc, passed: 4, total: 5, runOn: '2026-10-12' };
it.each([
	{ name: 'student records a run', role: 'student', attempt: 'same', body: runBody, status: 201, count: 1 },
	{ name: 'run without a check', role: 'student', attempt: 'same', body: { ...runBody, passed: 0, total: 0 }, status: 201, count: 1 },
	{ name: 'run of 100 tests', role: 'student', attempt: 'same', body: { ...runBody, passed: 100, total: 100 }, status: 201, count: 1 },
	{ name: 'parent records a run', role: 'parent', attempt: 'same', body: runBody, status: 403, count: 0 },
	{ name: 'run of an attempt of another problem', role: 'student', attempt: 'other', body: runBody, status: 404, count: 0 },
	{ name: 'more passed tests than tests', role: 'student', attempt: 'same', body: { ...runBody, passed: 6 }, status: 400, count: 0 },
	{ name: 'negative passed tests', role: 'student', attempt: 'same', body: { ...runBody, passed: -1 }, status: 400, count: 0 },
	{ name: 'run of 101 tests', role: 'student', attempt: 'same', body: { ...runBody, passed: 0, total: 101 }, status: 400, count: 0 },
	{ name: 'short code hash', role: 'student', attempt: 'same', body: { ...runBody, codeHash: abc.slice(1) }, status: 400, count: 0 },
	{ name: 'run date out of the calendar', role: 'student', attempt: 'same', body: { ...runBody, runOn: '2026-02-30' }, status: 400, count: 0 },
])('$name', async ({ role, attempt, body, status, count }) => {
	const id = crypto.randomUUID(), otherId = crypto.randomUUID(), attemptId = crypto.randomUUID();
	await env.DB.batch([insertProblem.bind(id, 'cf-1-a'), insertProblem.bind(otherId, 'cf-1-b'), insertAttempt.bind(attemptId, attempt === 'same' ? id : otherId, 'draft', runDocument, 'now')]);
	const response = await request(`/problems/${id}/runs`, 'POST', { attemptId, ...body }, role === 'parent' ? await login('parent') : cookie);
	expect(response.status).toBe(status);
	if (status === 201) expect(await response.json()).toEqual({ approachId: x, codeHash: body.codeHash, passed: body.passed, total: body.total, createdAt: expect.any(String) });
	expect(await env.DB.prepare('SELECT count(*) AS count FROM test_runs').first()).toEqual({ count });
});

// Both approaches of the attempt have the code "abc".
const insertRun = env.DB.prepare('INSERT INTO test_runs (id,problem_id,attempt_id,approach_id,code_hash,passed,total,run_on,created_at) VALUES (?,?,?,?,?,?,?,?,?)');
type Run = { attempt?: 'other'; approachId: string; passed: number; total: number; codeHash: string; createdAt: string };
const at = (hour: number) => `2026-10-12T${hour}:00:00.000Z`;
it.each<{ name: string; runs: Run[]; latest: Run[] }>([
	{ name: 'no runs', runs: [], latest: [] },
	{ name: 'latest run passes with the current code', runs: [{ approachId: x, passed: 5, total: 5, codeHash: abc, createdAt: at(10) }], latest: [{ approachId: x, passed: 5, total: 5, codeHash: abc, createdAt: at(10) }] },
	{ name: 'latest run passes with other code', runs: [{ approachId: x, passed: 5, total: 5, codeHash: other, createdAt: at(10) }], latest: [{ approachId: x, passed: 5, total: 5, codeHash: other, createdAt: at(10) }] },
	{ name: 'older run passes and latest run fails', runs: [{ approachId: x, passed: 5, total: 5, codeHash: abc, createdAt: at(10) }, { approachId: x, passed: 4, total: 5, codeHash: abc, createdAt: at(11) }], latest: [{ approachId: x, passed: 4, total: 5, codeHash: abc, createdAt: at(11) }] },
	{ name: 'older run fails and latest run passes', runs: [{ approachId: x, passed: 4, total: 5, codeHash: abc, createdAt: at(10) }, { approachId: x, passed: 5, total: 5, codeHash: abc, createdAt: at(11) }], latest: [{ approachId: x, passed: 5, total: 5, codeHash: abc, createdAt: at(11) }] },
	{ name: 'latest run without a check', runs: [{ approachId: x, passed: 0, total: 0, codeHash: abc, createdAt: at(10) }], latest: [{ approachId: x, passed: 0, total: 0, codeHash: abc, createdAt: at(10) }] },
	{ name: 'second approach passes', runs: [{ approachId: x, passed: 4, total: 5, codeHash: abc, createdAt: at(10) }, { approachId: y, passed: 5, total: 5, codeHash: abc, createdAt: at(10) }], latest: [{ approachId: x, passed: 4, total: 5, codeHash: abc, createdAt: at(10) }, { approachId: y, passed: 5, total: 5, codeHash: abc, createdAt: at(10) }] },
	{ name: 'passed run of an approach outside the attempt', runs: [{ approachId: z, passed: 5, total: 5, codeHash: abc, createdAt: at(10) }], latest: [{ approachId: z, passed: 5, total: 5, codeHash: abc, createdAt: at(10) }] },
	{ name: 'passed run of another attempt', runs: [{ attempt: 'other', approachId: x, passed: 5, total: 5, codeHash: abc, createdAt: at(10) }], latest: [] },
])('$name', async ({ runs, latest }) => {
	const id = crypto.randomUUID(), attemptId = crypto.randomUUID(), otherId = crypto.randomUUID();
	await env.DB.batch([insertProblem.bind(id, 'cf-1-a'), insertAttempt.bind(attemptId, id, 'draft', runDocument, at(12)), insertAttempt.bind(otherId, id, 'saved', runDocument, at(10)),
		...runs.map(run => insertRun.bind(crypto.randomUUID(), id, run.attempt ? otherId : attemptId, run.approachId, run.codeHash, run.passed, run.total, '2026-10-12', run.createdAt))]);
	const response = await request(`/problems/${id}/runs?attemptId=${attemptId}`, 'GET', undefined, cookie);
	expect(response.status).toBe(200);
	expect((await response.json() as Run[]).sort((a, b) => a.approachId.localeCompare(b.approachId))).toEqual(latest);
});
