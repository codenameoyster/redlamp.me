import { test, expect, signIn } from './fixtures';

test('adds metadata and finds the problem by its summary', async ({ page }) => {
	await signIn(page);
	await page.getByRole('link', { name: 'Problems', exact: true }).click();
	await page.getByRole('button', { name: 'Add a problem', exact: true }).click();
	await page.getByLabel('LeetCode URL').fill('https://leetcode.com/problems/minimum-window-substring/description/');
	await page.getByLabel('Title', { exact: true }).fill('Minimum Window Substring');
	await page.getByRole('dialog').getByLabel('Difficulty').selectOption('hard');
	await page.getByLabel('Topics', { exact: true }).fill('Sliding window, Hash map');
	await page.getByRole('button', { name: 'Save problem', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Minimum Window Substring', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Edit problem', exact: true }).click();
	await page.getByLabel('Summary', { exact: true }).fill('Explain the invariant.');
	await page.getByRole('button', { name: 'Save problem', exact: true }).click();
	await expect(page.getByText('Explain the invariant.', { exact: true })).toBeVisible();
	await page.getByRole('link', { name: 'Problems', exact: true }).click();
	await page.getByLabel('Search problems and notes', { exact: true }).fill('invariant');
	await page.getByRole('button', { name: 'Apply filters' }).click();
	await expect(page.getByRole('link', { name: 'Minimum Window Substring', exact: true })).toBeVisible();
});
