import { test, expect, signIn } from './fixtures';

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

test('keeps a discussion reply when the parent saves assignment details', async ({ page, notebook, baseURL }) => {
	await signIn(page, 'parent');
	const response = await page.request.post('/leetcode/api/homework', {
		headers: { Origin: new URL(baseURL!).origin },
		data: { problemId: notebook.problem.id, instructions: 'Explain the invariant.', dueDate: null },
	});
	expect(response.status()).toBe(201);
	const homework = await response.json();
	await page.goto(`/leetcode/homework/${homework.id}`);
	await page.getByLabel('Reply', { exact: true }).fill('Please compare the two approaches in this assignment.');
	await page.getByRole('button', { name: 'Edit assignment', exact: true }).click();
	await page.getByLabel('Instructions', { exact: true }).fill('Explain the invariant and the time complexity.');
	await page.getByRole('button', { name: 'Save assignment', exact: true }).click();
	await expect(page.getByText('Explain the invariant and the time complexity.', { exact: true })).toBeVisible();
	await expect(page.getByLabel('Reply', { exact: true })).toHaveValue('Please compare the two approaches in this assignment.');
	await page.getByRole('button', { name: 'Add reply', exact: true }).click();
	await expect(page.getByText('Please compare the two approaches in this assignment.', { exact: true })).toBeVisible();
});
