import { test, expect, addTask, type TestEnv } from './fixtures';

const dueDates = [
	{ name: 'submitted homework past its due date is not overdue', state: 'submitted', due: 'Due 2020-01-01' },
	{ name: 'assigned homework past its due date is overdue', state: 'assigned', due: 'Due 2020-01-01 - Overdue' },
];
for (const row of dueDates) {
	test(row.name, async ({ page, server, notebook }) => {
		const { DB } = await server.getWorker<TestEnv>().getEnv();
		const { taskId } = await addTask(DB, notebook.problem.id, row.state, '2020-01-01');
		await page.goto('/leetcode');
		await expect(page.getByText(row.due, { exact: true })).toBeVisible();
		await expect(page.locator(`a[href="/leetcode/tasks/${taskId}"]`)).toHaveText(notebook.problem.title);
		await expect(page.getByText('Week 41', { exact: true })).toBeVisible();
	});
}

const nextSteps = [
	{ name: 'student with only completed homework sees the problem library', homework: 'completed' },
	{ name: 'student with only submitted homework sees the problem library', homework: 'submitted' },
];
for (const row of nextSteps) {
	test(row.name, async ({ page, server, notebook }) => {
		const { DB } = await server.getWorker<TestEnv>().getEnv();
		await DB.prepare("UPDATE attempts SET state='saved',saved_at='now' WHERE id=?").bind(notebook.attempt.id).run();
		await addTask(DB, notebook.problem.id, row.homework, '2020-01-01');
		await page.goto('/leetcode');
		await expect(page.getByRole('heading', { name: 'Choose your next problem.' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Open the problem library' })).toHaveAttribute('href', '/leetcode/problems');
		await expect(page.getByRole('heading', { name: 'Your first problem starts here.' })).toHaveCount(0);
	});
}
