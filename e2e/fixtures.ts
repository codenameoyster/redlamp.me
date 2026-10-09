import { test as base, expect, type Page } from '@playwright/test';
import { createTestHarness, type TestHarness } from 'wrangler';
import { testAccountSecret } from '../test/fixtures';
import type { D1Database } from '@cloudflare/workers-types';
import type { Attempt, Problem, Role, TutorKind } from '../shared/leetcode';

export interface TestEnv { DB: D1Database }

export async function signIn(page: Page, role: Role = 'student') {
	await page.goto('/leetcode/login');
	await page.getByLabel('Username').fill(`${role}-test`);
	await page.getByLabel('Password').fill(role === 'student' ? 'student-test-password-01' : 'parent-test-password-001');
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
}

export async function addTask(DB: D1Database, problemId: string, state = 'assigned', dueDate: string | null = null) {
	const homeworkId = crypto.randomUUID(), taskId = crypto.randomUUID();
	await DB.batch([
		DB.prepare("INSERT INTO homework (id,title,instructions,due_date,created_at,updated_at) VALUES (?,'Week 41','Explain',?,'now','now')").bind(homeworkId, dueDate),
		DB.prepare("INSERT INTO homework_tasks (id,homework_id,problem_id,state,created_at,updated_at) VALUES (?,?,?,?,'now','now')").bind(taskId, homeworkId, problemId, state),
	]);
	return { homeworkId, taskId };
}

// One minute between messages, so the order is fixed.
export async function addMessages(DB: D1Database, kind: TutorKind, ref: string, messages: { author: 'student' | 'assistant'; body: string; quote?: string }[], start = '2026-10-09T10:00:00.000Z') {
	await DB.batch(messages.map((m, i) => DB.prepare('INSERT INTO tutor_messages (id,context_kind,context_ref,author,body,quote,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(), kind, ref, m.author, m.body, m.quote ?? null, new Date(Date.parse(start) + i * 60_000).toISOString())));
}

export const test = base.extend<{ reset: void; notebook: { problem: Problem; attempt: Attempt } }, { server: TestHarness }>({
	server: [async ({ browserName }, use) => {
		if (browserName !== 'chromium') throw new Error('Use Chromium for these checks.');
		const server = createTestHarness({ workers: [{ configPath: './wrangler.toml', vars: { LEETCODE_LOCAL_HTTP: '1' }, secrets: { LEETCODE_ACCOUNTS: testAccountSecret } }] });
		await server.listen();
		try { await use(server); } finally { await server.close(); }
	}, { scope: 'worker' }],
	baseURL: async ({ server }, use) => { await use((await server.listen()).url.href); },
	reset: [async ({ server }, use) => {
		await server.getWorker<TestEnv>().applyD1Migrations('DB');
		try { await use(); } finally { await server.reset(); }
	}, { auto: true }],
	notebook: async ({ page, baseURL }, use) => {
		await signIn(page);
		const headers = { Origin: new URL(baseURL!).origin };
		const created = await page.request.post('/leetcode/api/problems', { headers, data: { url: 'https://leetcode.com/problems/two-sum/', number: 1, title: 'Two Sum', difficulty: 'easy', topics: ['Arrays'], summary: 'Find two values with the target sum.' } });
		expect(created.status()).toBe(201);
		const problem = await created.json() as Problem;
		const response = await page.request.post(`/leetcode/api/problems/${problem.id}/attempts`, { headers, data: {} });
		expect(response.status()).toBe(201);
		const attempt = await response.json() as Attempt;
		await page.goto(`/leetcode/problems/${problem.id}`);
		await expect(page.getByLabel('Key idea', { exact: true })).toBeVisible();
		await use({ problem, attempt });
	},
});
export { expect };
