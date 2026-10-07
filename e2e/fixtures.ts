import { test as base, expect, type Page } from '@playwright/test';
import { createTestHarness, type TestHarness } from 'wrangler';
import { testAccountSecret } from '../test/fixtures';
import type { D1Database } from '@cloudflare/workers-types';
import type { Attempt, Problem, Role } from '../shared/leetcode';

export interface TestEnv { DB: D1Database }

export async function signIn(page: Page, role: Role = 'student') {
	await page.goto('/leetcode/login');
	await page.getByLabel('Username').fill(`${role}-test`);
	await page.getByLabel('Password').fill(role === 'student' ? 'student-test-password-01' : 'parent-test-password-001');
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
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
