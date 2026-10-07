import { test, expect } from './fixtures';

test('logout blocks browser history', async ({ page, notebook }) => {
	await expect(page.getByRole('heading', { name: notebook.problem.title, exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Log out' }).click();
	await expect(page.getByLabel('Password')).toBeVisible();
	await page.goBack();
	await expect(page.getByLabel('Password')).toBeVisible();
	await expect(page.getByLabel('Key idea', { exact: true })).toHaveCount(0);
});

test('protects direct paths and serves the public site', async ({ page, request }) => {
	await page.goto('/leetcode/problems');
	await expect(page.getByLabel('Password')).toBeVisible();
	const privateResponse = await request.get('/leetcode/api/lessons/11111111-1111-4111-8111-111111111111/content');
	expect(privateResponse.status()).toBe(401);
	expect((await request.get('/')).status()).toBe(200);
	expect((await request.get('/leetcode/assets/main.js')).status()).toBe(200);
});
