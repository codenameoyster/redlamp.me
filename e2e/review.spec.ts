import { test, expect, type TestEnv } from './fixtures';

test('reads saved attempts beyond the first page and returns to newer work', async ({ page, notebook, server }) => {
	const { DB } = await server.getWorker<TestEnv>().getEnv(), ids = Array.from({ length: 51 }, () => crypto.randomUUID());
	const insert = DB.prepare("INSERT INTO attempts (id,problem_id,state,document,search_text,acceptance,understanding,created_at,updated_at,saved_at) VALUES (?,?,'saved',?,'','not_submitted','needs_practice',?,?,?)");
	await DB.batch(ids.map((id, i) => {
		const at = new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString();
		const document = { ...notebook.attempt.document, approaches: [{ ...notebook.attempt.document.approaches[0], code: `print('saved_${i}')` }] };
		return insert.bind(id, notebook.problem.id, JSON.stringify(document), at, at, at);
	}));
	await page.getByRole('link', { name: 'Повторить задачу', exact: true }).click();
	await page.getByRole('button', { name: 'Показать сохранённую работу', exact: true }).click();
	const attempts = page.getByRole('combobox', { name: 'Сохранённая попытка', exact: true }), code = page.getByLabel('Код решения', { exact: true });
	await expect(attempts.locator('option')).toHaveCount(49);
	await attempts.selectOption(ids[49]);
	await expect(code).toHaveText("print('saved_49')");
	await page.getByRole('button', { name: 'Старые попытки', exact: true }).click();
	await expect(attempts.locator('option')).toHaveCount(2);
	await expect(code).toHaveText("print('saved_1')");
	await attempts.selectOption(ids[0]);
	await expect(code).toHaveText("print('saved_0')");
	await page.getByRole('button', { name: 'Новые попытки', exact: true }).click();
	await expect(code).toHaveText("print('saved_50')");
	await expect(attempts.locator('option')).toHaveCount(49);
});

test('reveals saved work on request and keeps acceptance after a failed review', async ({ page, notebook }) => {
	await page.getByLabel('Код решения', { exact: true }).fill('return saved_solution');
	await page.getByRole('button', { name: 'Решено', exact: true }).click();
	await expect(page.getByText('Попытка сохранена.', { exact: true })).toBeVisible();
	await page.getByRole('link', { name: 'Повторить задачу' }).click();
	await expect(page.getByRole('button', { name: 'Показать сохранённую работу' })).toBeVisible();
	await expect(page.getByLabel('Код решения', { exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Показать сохранённую работу' }).click();
	await expect(page.getByLabel('Код решения', { exact: true })).toHaveText('return saved_solution');
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
