import { readFileSync } from 'node:fs';
import { test, expect, signIn } from './fixtures';

type Marked = Window & { kept?: boolean };

test('changes the page without a reload and keeps the history', async ({ page, notebook }) => {
	await page.goto('/leetcode');
	await page.evaluate(() => { (window as Marked).kept = true; });
	const problems = page.getByRole('navigation', { name: 'Тетрадь' }).getByRole('link', { name: 'Задачи', exact: true });
	await problems.click();
	await expect(page).toHaveURL(/\/leetcode\/problems$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Задачи' })).toBeVisible();
	await expect(problems).toHaveAttribute('aria-current', 'page');
	await page.getByRole('link', { name: notebook.problem.title }).first().click();
	await expect(page).toHaveURL(`/leetcode/problems/${notebook.problem.id}`);
	await page.goBack();
	await expect(page.getByRole('heading', { level: 1, name: 'Задачи' })).toBeVisible();
	await page.goBack();
	await expect(page.getByRole('heading', { level: 1, name: 'Стройте понимание, задача за задачей.' })).toBeVisible();
	await page.goForward();
	await expect(page.getByRole('heading', { level: 1, name: 'Задачи' })).toBeVisible();
	expect(await page.evaluate(() => (window as Marked).kept)).toBe(true);
});

test('shows the version of package.json after the name', async ({ page }) => {
	const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
	await signIn(page);
	await expect(page.getByRole('link', { name: `redlamp ${version} Тетрадь LeetCode`, exact: true })).toHaveAttribute('href', '/leetcode');
});
