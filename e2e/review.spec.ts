import { test, expect } from './fixtures';

test('reveals saved work on request and keeps acceptance after a failed review', async ({ page, notebook }) => {
	await page.getByLabel('Код решения', { exact: true }).fill('return saved_solution');
	await page.getByRole('combobox', { name: 'Статус на LeetCode', exact: true }).selectOption('accepted');
	await page.getByRole('combobox', { name: 'Понимание', exact: true }).selectOption('independent');
	await page.getByRole('button', { name: 'Сохранить попытку', exact: true }).click();
	await expect(page.getByText('Попытка сохранена.', { exact: true })).toBeVisible();
	await page.getByRole('link', { name: 'Повторить задачу' }).click();
	await expect(page.getByRole('button', { name: 'Показать сохранённую работу' })).toBeVisible();
	await expect(page.getByLabel('Код решения', { exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Показать сохранённую работу' }).click();
	await expect(page.getByLabel('Код решения', { exact: true })).toHaveValue('return saved_solution');
	await page.getByRole('button', { name: 'Нужно потренироваться', exact: true }).click();
	await page.getByLabel('Следующее повторение', { exact: true }).fill('2026-12-31');
	await page.getByRole('button', { name: 'Сохранить повторение', exact: true }).click();
	await expect(page.getByText('Повторение сохранено.', { exact: true })).toBeVisible();
	const response = await page.request.get(`/leetcode/api/problems/${notebook.problem.id}`);
	expect(await response.json()).toMatchObject({ solved: true, understanding: 'needs_practice', nextReviewDate: '2026-12-31' });
});

test('uses the local calendar date near midnight', async ({ browser, baseURL, notebook }) => {
	const context = await browser.newContext({ baseURL, timezoneId: 'America/Los_Angeles' });
	const page = await context.newPage();
	try {
		await page.clock.install({ time: new Date('2026-10-08T01:00:00Z') });
		await page.goto('/leetcode/login');
		await page.getByLabel('Имя пользователя').fill('student-test'); await page.getByLabel('Пароль').fill('student-test-password-01');
		const dashboard = page.waitForRequest(request => request.url().includes('/api/dashboard'));
		await page.getByRole('button', { name: 'Войти', exact: true }).click();
		expect(new URL((await dashboard).url()).searchParams.get('today')).toBe('2026-10-07');
		await expect(page.getByRole('link', { name: notebook.problem.title, exact: true }).first()).toBeVisible();
	} finally { await context.close(); }
});
