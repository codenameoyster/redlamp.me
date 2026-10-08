import { test, expect, signIn } from './fixtures';
import type { TaskDetails } from '../shared/leetcode';

test('completes learning with two accounts, two approaches, and a linked lesson', async ({ page: parent, browser, baseURL }, testInfo) => {
	const studentContext = await browser.newContext({ baseURL, viewport: testInfo.project.use.viewport });
	const student = await studentContext.newPage();
	try {
		await signIn(parent, 'parent');
		await parent.getByRole('link', { name: 'Problems', exact: true }).click();
		await parent.getByRole('button', { name: 'Add a problem', exact: true }).click();
		await parent.getByLabel('LeetCode URL').fill('https://leetcode.com/problems/minimum-window-substring/');
		await parent.getByLabel('Title', { exact: true }).fill('Minimum Window Substring');
		await parent.getByRole('dialog').getByRole('combobox', { name: 'Difficulty' }).selectOption('hard');
		await parent.getByLabel('Topics', { exact: true }).fill('Sliding window, Hash map');
		await parent.getByRole('button', { name: 'Save problem', exact: true }).click();
		await expect(parent.getByRole('heading', { name: 'Minimum Window Substring', exact: true })).toBeVisible();
		const problemId = parent.url().split('/').at(-1)!;
		await parent.getByRole('link', { name: 'Lessons', exact: true }).click();
		await parent.getByLabel('Title', { exact: true }).fill('Window invariant');
		await parent.getByLabel('HTML file').setInputFiles({ name: 'window.html', mimeType: 'text/html', buffer: Buffer.from('<button onclick="this.textContent=\'Window is valid\'">Move the window</button>') });
		await parent.getByRole('button', { name: 'Upload and preview' }).click();
		await expect(parent.getByRole('heading', { name: 'Window invariant' })).toBeVisible();
		const lessonId = parent.url().split('/').at(-1)!;
		await parent.getByRole('link', { name: 'Homework', exact: true }).click();
		await parent.getByLabel('Title', { exact: true }).fill('Week 41: sliding window');
		await parent.getByLabel('Instructions', { exact: true }).fill('Compare two approaches. Explain when the window can shrink.');
		await parent.getByRole('button', { name: 'Create homework', exact: true }).click();
		await expect(parent.getByRole('heading', { name: 'Week 41: sliding window', level: 1 })).toBeVisible();
		await parent.getByRole('group', { name: 'Problem', exact: true }).getByRole('radio', { name: /^Minimum Window Substring/ }).check();
		await parent.getByRole('button', { name: 'Add task', exact: true }).click();
		await expect(parent.getByText('Assigned', { exact: true })).toBeVisible();
		await parent.getByRole('combobox', { name: 'Related lesson', exact: true }).selectOption(`lessons/${lessonId}`);
		await parent.getByRole('button', { name: 'Link lesson' }).click();
		await expect(parent.getByRole('link', { name: 'Window invariant', exact: true })).toBeVisible();
		await parent.getByRole('link', { name: 'Minimum Window Substring', exact: true }).click();
		await expect(parent.getByRole('heading', { name: 'Minimum Window Substring', level: 1 })).toBeVisible();
		const taskURL = parent.url(), taskId = taskURL.split('/').at(-1)!;
		await signIn(student);
		await student.goto(taskURL);
		await student.getByRole('link', { name: 'Window invariant', exact: true }).click();
		await student.frameLocator('iframe').getByRole('button', { name: 'Move the window' }).click();
		await expect(student.frameLocator('iframe').getByRole('button', { name: 'Window is valid' })).toBeVisible();
		await student.getByRole('link', { name: 'Back', exact: true }).click();
		await student.getByRole('link', { name: 'Open notebook', exact: true }).click();
		await student.getByRole('button', { name: 'Start another attempt' }).click();
		await student.getByLabel('Approach name', { exact: true }).fill('Brute force');
		await student.getByLabel('Key idea', { exact: true }).fill('Try every substring and count its characters.');
		await student.getByLabel('Solution code', { exact: true }).fill('return brute_force(source, target)');
		await student.getByRole('button', { name: 'Add approach' }).click();
		const second = student.getByRole('region', { name: 'Approach 2', exact: true });
		await second.getByLabel('Approach name', { exact: true }).fill('Sliding window');
		await second.getByLabel('Key idea', { exact: true }).fill('Shrink only while all target counts are satisfied.');
		await second.getByLabel('Solution code', { exact: true }).fill(`return sliding_window(source, target) # ${'long_code_line_'.repeat(40)}`);
		await student.getByRole('combobox', { name: 'LeetCode acceptance', exact: true }).selectOption('accepted');
		await student.getByRole('combobox', { name: 'Understanding', exact: true }).selectOption('with_help');
		await student.getByRole('button', { name: 'In three days', exact: true }).click();
		expect(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		await student.screenshot({ path: testInfo.outputPath('notebook.png'), fullPage: true });
		await student.getByRole('button', { name: 'Submit for review', exact: true }).click();
		await expect(student.getByRole('button', { name: 'Copy into new draft' })).toBeVisible();
		await parent.reload();
		await expect(parent.getByText('Submitted for review', { exact: true })).toBeVisible();
		const firstDetails = await (await parent.request.get(`/leetcode/api/tasks/${taskId}`)).json() as TaskDetails;
		const firstAttemptId = firstDetails.submissions[0].attemptId;
		await parent.getByLabel('Review feedback', { exact: true }).fill('Explain why shrinking cannot miss a shorter valid window.');
		await parent.getByRole('button', { name: 'Request another attempt' }).click();
		await expect(parent.getByText('Another attempt requested', { exact: true }).first()).toBeVisible();
		await parent.getByRole('link', { name: 'Week 41: sliding window', exact: true }).click();
		const tasks = parent.getByRole('region', { name: 'Tasks' }), title = (await tasks.getByRole('link', { name: 'Minimum Window Substring', exact: true }).boundingBox())!, difficulty = (await tasks.getByText('hard', { exact: true }).boundingBox())!;
		expect(title.x + title.width <= difficulty.x || title.y + title.height <= difficulty.y).toBe(true);
		await parent.goto(taskURL);
		await student.reload();
		await student.getByRole('button', { name: 'Copy into new draft' }).click();
		await student.getByLabel('Why it works', { exact: true }).nth(1).fill('Each valid left boundary is checked before it is removed.');
		await student.getByLabel('Solution code', { exact: true }).first().fill('return revised_brute_force(source, target)');
		await student.getByRole('button', { name: 'Save attempt', exact: true }).click();
		await expect(student.getByRole('button', { name: 'Copy into new draft' })).toBeVisible();
		await student.goto(taskURL);
		await student.getByRole('button', { name: 'Submit for review', exact: true }).click();
		await expect(student.getByText('Submitted for review', { exact: true })).toBeVisible();
		await parent.reload();
		await parent.getByRole('button', { name: 'Complete task' }).click();
		await expect(parent.getByText('Completed', { exact: true }).first()).toBeVisible();
		const original = await (await parent.request.get(`/leetcode/api/problems/${problemId}/attempts/${firstAttemptId}`)).json();
		expect(original.document.approaches[0].code).toBe('return brute_force(source, target)');
		expect(await (await parent.request.get(`/leetcode/api/problems/${problemId}`)).json()).toMatchObject({ solved: true, understanding: 'with_help' });
		await parent.getByRole('link', { name: 'Today', exact: true }).click();
		await expect(parent.getByRole('heading', { name: 'Topic understanding' })).toBeVisible();
		await parent.screenshot({ path: testInfo.outputPath('today.png'), fullPage: true });
	} finally { await studentContext.close(); }
});

const emptyStates = [
	{ name: 'empty notebook shows the first-problem prompt', path: '/leetcode', text: 'Your first problem starts here.' },
	{ name: 'empty library shows the empty library message', path: '/leetcode/problems', text: 'No problems match. Add a problem or change the filters.' },
];
for (const row of emptyStates) {
	test(row.name, async ({ page }) => {
		await signIn(page, 'parent');
		await page.goto(row.path);
		await expect(page.getByText(row.text, { exact: true })).toBeVisible();
	});
}

test('switches the appearance from the top bar and keeps it after a reload', async ({ page }) => {
	await signIn(page, 'parent');
	const bar = page.getByRole('banner');
	await expect(bar.getByText('parent-test', { exact: true })).toBeVisible();
	await expect(bar.getByRole('button', { name: 'Log out', exact: true })).toBeVisible();
	await bar.getByRole('button', { name: 'Dark appearance', exact: true }).click();
	await expect(bar.getByRole('button', { name: 'Light appearance', exact: true })).toBeVisible();
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
});

test('opens and closes the problem dialog with the keyboard', async ({ page }) => {
	await signIn(page, 'parent');
	await page.goto('/leetcode/problems');
	await page.getByRole('button', { name: 'Add a problem', exact: true }).focus();
	await page.keyboard.press('Enter');
	await expect(page.getByLabel('LeetCode URL')).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('button', { name: 'Add a problem', exact: true })).toBeFocused();
});

test('rejects an oversized lesson file', async ({ page }) => {
	await signIn(page, 'parent');
	await page.goto('/leetcode/lessons');
	await page.getByLabel('Title', { exact: true }).fill('Oversized file');
	await page.getByLabel('HTML file').setInputFiles({ name: 'large.html', mimeType: 'text/html', buffer: Buffer.alloc(1_000_001, 'x') });
	await page.getByRole('button', { name: 'Upload and preview' }).click();
	await expect(page.getByRole('alert')).toContainText('1,000,000 bytes');
});
