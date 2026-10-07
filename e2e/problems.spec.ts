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

test('restores an archived problem to the active library', async ({ page, notebook }) => {
	const question = new Promise<string>(resolve => page.once('dialog', dialog => { resolve(dialog.message()); void dialog.accept(); }));
	await page.getByRole('button', { name: 'Archive problem', exact: true }).click();
	expect(await question).toBe('Archive this problem? You can restore it later.');
	await expect(page.getByText('Archived', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Restore problem', exact: true }).click();
	await expect(page.getByText('Archived', { exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Archive problem', exact: true })).toBeVisible();
	await page.getByRole('link', { name: 'Problems', exact: true }).click();
	await expect(page.getByRole('link', { name: notebook.problem.title, exact: true })).toBeVisible();
});

test.describe('LeetCode details', () => {
	const url = 'https://leetcode.com/problems/minimum-window-substring/description/';
	test.beforeEach(async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await signIn(page);
		await page.goto('/leetcode/problems');
		await page.getByRole('button', { name: 'Add a problem', exact: true }).click();
		await page.evaluate(text => navigator.clipboard.writeText(text), url);
	});

	test('fills the problem details after a LeetCode URL is pasted', async ({ page }) => {
		let release!: () => void, requested = '';
		const held = new Promise<void>(resolve => { release = resolve; });
		await page.route('**/leetcode/api/problem-details?*', async route => {
			requested = new URL(route.request().url()).searchParams.get('url')!;
			await held;
			await route.fulfill({ json: { number: 76, title: 'Minimum Window Substring', difficulty: 'hard', topics: ['Hash Table', 'String', 'Sliding Window'] } });
		});
		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('LeetCode URL').focus();
		await page.keyboard.press('ControlOrMeta+V');
		await expect(dialog.getByRole('status')).toHaveText('Filling in details from LeetCode');
		release();
		await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue('Minimum Window Substring');
		await expect(dialog.getByLabel('Problem number')).toHaveValue('76');
		await expect(dialog.getByLabel('Difficulty')).toHaveValue('hard');
		await expect(dialog.getByLabel('Topics', { exact: true })).toHaveValue('Hash Table, String, Sliding Window');
		await expect(dialog.getByRole('status')).toHaveCount(0);
		expect(requested).toBe(url);
	});

	test('keeps the fields for manual entry when the LeetCode details are unavailable', async ({ page }) => {
		await page.route('**/leetcode/api/problem-details?*', route => route.fulfill({ status: 502, json: { error: { code: 'lookup_failed', message: 'LeetCode details are unavailable. Enter them yourself.' } } }));
		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('LeetCode URL').focus();
		await page.keyboard.press('ControlOrMeta+V');
		await expect(dialog.getByRole('status')).toHaveText('LeetCode details are unavailable. Enter them yourself.');
		await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue('');
		await expect(dialog.getByLabel('LeetCode URL')).toHaveValue(url);
	});
});
