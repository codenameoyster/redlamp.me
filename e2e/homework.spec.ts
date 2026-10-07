import { test, expect, signIn, type TestEnv } from './fixtures';
import type { Attempt } from '../shared/leetcode';

test('assigns, submits, requests changes, and completes homework', async ({ page, notebook }) => {
	await signIn(page, 'parent');
	await page.getByRole('link', { name: 'Homework', exact: true }).click();
	await page.getByRole('combobox', { name: 'Problem', exact: true }).selectOption(notebook.problem.id);
	await page.getByLabel('Instructions', { exact: true }).fill('Explain the invariant.');
	await page.getByRole('button', { name: 'Assign homework', exact: true }).click();
	await expect(page.getByText('Assigned', { exact: true })).toBeVisible();
	const homeworkURL = page.url();
	await signIn(page);
	await page.goto(`/leetcode/problems/${notebook.problem.id}`);
	await page.getByLabel('Key idea', { exact: true }).fill('Track the needed values.');
	await page.getByRole('button', { name: 'Submit for review', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Copy into new draft' })).toBeVisible();
	await page.goto(homeworkURL);
	await expect(page.getByText('Submitted for review', { exact: true })).toBeVisible();
	await signIn(page, 'parent');
	await page.goto(homeworkURL);
	await expect(page.getByLabel('Key idea', { exact: true })).toHaveValue('Track the needed values.');
	await page.getByLabel('Review feedback', { exact: true }).fill('Add a correctness argument.');
	await page.getByRole('button', { name: 'Request another attempt' }).click();
	await expect(page.getByText('Another attempt requested', { exact: true }).first()).toBeVisible();
	await expect(page.getByText('Add a correctness argument.', { exact: true })).toBeVisible();
	await signIn(page);
	await page.goto(`/leetcode/problems/${notebook.problem.id}`);
	await page.getByRole('button', { name: 'Copy into new draft' }).click();
	await page.getByLabel('Why it works', { exact: true }).fill('Every earlier value is in the frequency map.');
	await page.getByRole('button', { name: 'Submit for review', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Copy into new draft' })).toBeVisible();
	await signIn(page, 'parent');
	await page.goto(homeworkURL);
	await page.getByRole('button', { name: 'Complete homework' }).click();
	await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible();
});

test('keeps a discussion reply and opens the newest replies when the parent saves assignment details', async ({ page, notebook, baseURL, server }) => {
	const { DB } = await server.getWorker<TestEnv>().getEnv();
	await DB.batch(Array.from({ length: 51 }, (_, i) => DB.prepare("INSERT INTO feedback (id,problem_id,author,kind,body,created_at) VALUES (?,?,'student','reply',?,?)").bind(crypto.randomUUID(), notebook.problem.id, `Comment ${i + 1}`, new Date(Date.UTC(2020, 0, 1, 0, i)).toISOString())));
	await signIn(page, 'parent');
	const response = await page.request.post('/leetcode/api/homework', {
		headers: { Origin: new URL(baseURL!).origin },
		data: { problemId: notebook.problem.id, instructions: 'Explain the invariant.', dueDate: null },
	});
	expect(response.status()).toBe(201);
	const homework = await response.json();
	await page.goto(`/leetcode/homework/${homework.id}`);
	await page.getByRole('button', { name: 'Older replies', exact: true }).click();
	await expect(page.getByText('Comment 1', { exact: true })).toBeVisible();
	await page.getByLabel('Reply', { exact: true }).fill('Please compare the two approaches in this assignment.');
	await page.getByRole('button', { name: 'Edit assignment', exact: true }).click();
	await page.getByLabel('Instructions', { exact: true }).fill('Explain the invariant and the time complexity.');
	await page.getByRole('button', { name: 'Save assignment', exact: true }).click();
	await expect(page.getByText('Explain the invariant and the time complexity.', { exact: true })).toBeVisible();
	await expect(page.getByText('Comment 51', { exact: true })).toBeVisible();
	await expect(page.getByLabel('Reply', { exact: true })).toHaveValue('Please compare the two approaches in this assignment.');
	await page.getByRole('button', { name: 'Add reply', exact: true }).click();
	await expect(page.getByText('Please compare the two approaches in this assignment.', { exact: true })).toBeVisible();
});

test('numbers attempts to submit like the notebook history', async ({ page, notebook, baseURL, server }) => {
	const headers = { Origin: new URL(baseURL!).origin }, attempts = `/leetcode/api/problems/${notebook.problem.id}/attempts`;
	expect((await page.request.post(`${attempts}/${notebook.attempt.id}/save`, { headers, data: { version: notebook.attempt.version } })).status()).toBe(200);
	const second = await (await page.request.post(attempts, { headers, data: {} })).json() as Attempt;
	expect((await page.request.post(`${attempts}/${second.id}/save`, { headers, data: { version: second.version } })).status()).toBe(200);
	expect((await page.request.post(attempts, { headers, data: {} })).status()).toBe(201);
	const { DB } = await server.getWorker<TestEnv>().getEnv(), homeworkId = crypto.randomUUID();
	await DB.prepare("INSERT INTO homework (id,problem_id,instructions,state,created_at,updated_at) VALUES (?,?,'Explain','assigned','now','now')").bind(homeworkId, notebook.problem.id).run();
	await page.reload();
	const history = page.getByRole('combobox', { name: 'Attempt history', exact: true }).locator('option:not([disabled])');
	await expect(history).toHaveCount(3);
	const labels = await history.allTextContents();
	expect(labels.map(label => label.split(' - ')[0])).toEqual(['Current draft', 'Saved attempt 2', 'Saved attempt 1']);
	await page.goto(`/leetcode/homework/${homeworkId}`);
	await expect(page.getByRole('combobox', { name: 'Attempt to submit', exact: true }).locator('option')).toHaveText(labels);
});

test('assigns the selected problem after the problem search refreshes', async ({ page, notebook, baseURL }) => {
	const created = await page.request.post('/leetcode/api/problems', { headers: { Origin: new URL(baseURL!).origin }, data: { url: 'https://leetcode.com/problems/3sum/', number: 15, title: '3Sum', difficulty: 'medium', topics: ['Arrays'], summary: 'Find triplets with a zero sum.' } });
	expect(created.status()).toBe(201);
	await signIn(page, 'parent');
	await page.goto('/leetcode/homework');
	const problem = page.getByRole('combobox', { name: 'Problem', exact: true });
	await problem.selectOption(notebook.problem.id);
	let release!: () => void;
	const held = new Promise<void>(resolve => { release = resolve; });
	await page.route(url => url.pathname === '/leetcode/api/problems' && url.searchParams.get('q') === 'Sum', async route => { await held; await route.continue(); });
	const search = page.waitForRequest(request => new URL(request.url()).searchParams.get('q') === 'Sum');
	await page.getByRole('searchbox', { name: 'Find a problem', exact: true }).fill('Sum');
	await search;
	await expect(problem).toHaveValue(notebook.problem.id);
	release();
	await expect(problem.locator('option')).toHaveText(['Select a problem', '3Sum', notebook.problem.title]);
	await expect(problem).toHaveValue(notebook.problem.id);
	await page.getByRole('searchbox', { name: 'Find a problem', exact: true }).fill('3Sum');
	await expect(problem.locator('option')).toHaveText(['Select a problem', notebook.problem.title, '3Sum']);
	await expect(problem).toHaveValue(notebook.problem.id);
	await page.getByRole('button', { name: 'Assign homework', exact: true }).click();
	await expect(page.getByRole('heading', { name: notebook.problem.title, level: 1 })).toBeVisible();
});
