import { test, expect, signIn } from './fixtures';

test('adds metadata and finds the problem by its summary', async ({ page }) => {
	await signIn(page);
	await page.route('**/leetcode/api/problems/*/statement', route => route.fulfill({ json: { html: null, text: null } }));
	await page.getByRole('link', { name: 'Задачи', exact: true }).click();
	await page.getByRole('button', { name: 'Добавить задачу', exact: true }).click();
	await page.getByLabel('Ссылка на задачу').fill('https://leetcode.com/problems/minimum-window-substring/description/');
	await page.getByLabel('Название', { exact: true }).fill('Minimum Window Substring');
	await page.getByRole('dialog').getByLabel('Сложность').selectOption('hard');
	await page.getByLabel('Темы', { exact: true }).fill('Sliding window, Hash map');
	await page.getByRole('button', { name: 'Сохранить задачу', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Minimum Window Substring', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Изменить задачу', exact: true }).click();
	await page.getByLabel('Описание', { exact: true }).fill('Explain the invariant.');
	await page.getByRole('button', { name: 'Сохранить задачу', exact: true }).click();
	await expect(page.getByText('Explain the invariant.', { exact: true })).toBeVisible();
	await page.getByRole('link', { name: 'Задачи', exact: true }).click();
	await page.getByLabel('Поиск по задачам и заметкам', { exact: true }).fill('invariant');
	await page.getByRole('button', { name: 'Применить фильтры' }).click();
	await expect(page.getByRole('link', { name: 'Minimum Window Substring', exact: true })).toBeVisible();
});

test('restores an archived problem to the active library', async ({ page, notebook }) => {
	const question = new Promise<string>(resolve => page.once('dialog', dialog => { resolve(dialog.message()); void dialog.accept(); }));
	await page.getByRole('button', { name: 'В архив', exact: true }).click();
	expect(await question).toBe('Отправить задачу в архив? Её можно вернуть позже.');
	await expect(page.getByText('В архиве', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Вернуть из архива', exact: true }).click();
	await expect(page.getByText('В архиве', { exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'В архив', exact: true })).toBeVisible();
	await page.getByRole('link', { name: 'Задачи', exact: true }).click();
	await expect(page.getByRole('link', { name: notebook.problem.title, exact: true })).toBeVisible();
});

test.describe('problem details', () => {
	const url = 'https://leetcode.com/problems/minimum-window-substring/description/';
	test.beforeEach(async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await signIn(page);
		await page.goto('/leetcode/problems');
		await page.getByRole('button', { name: 'Добавить задачу', exact: true }).click();
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
		await dialog.getByLabel('Ссылка на задачу').focus();
		await page.keyboard.press('ControlOrMeta+V');
		await expect(dialog.getByRole('status')).toHaveText('Заполняем данные из LeetCode');
		release();
		await expect(dialog.getByLabel('Название', { exact: true })).toHaveValue('Minimum Window Substring');
		await expect(dialog.getByLabel('Номер задачи')).toHaveValue('76');
		await expect(dialog.getByLabel('Сложность')).toHaveValue('hard');
		await expect(dialog.getByLabel('Темы', { exact: true })).toHaveValue('Hash Table, String, Sliding Window');
		await expect(dialog.getByRole('status')).toHaveCount(0);
		expect(requested).toBe(url);
	});

	test('keeps the fields for manual entry when the LeetCode details are unavailable', async ({ page }) => {
		await page.route('**/leetcode/api/problem-details?*', route => route.fulfill({ status: 502, json: { error: { code: 'lookup_failed', message: 'LeetCode details are unavailable. Enter them yourself.' } } }));
		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('Ссылка на задачу').focus();
		await page.keyboard.press('ControlOrMeta+V');
		await expect(dialog.getByRole('status')).toHaveText('LeetCode details are unavailable. Enter them yourself.');
		await expect(dialog.getByLabel('Название', { exact: true })).toHaveValue('');
		await expect(dialog.getByLabel('Ссылка на задачу')).toHaveValue(url);
	});

	test('adds a Codeforces problem without the LeetCode auto-fill', async ({ page }) => {
		let looked = false;
		await page.route('**/leetcode/api/problem-details?*', route => { looked = true; return route.fulfill({ status: 500 }); });
		await page.evaluate(text => navigator.clipboard.writeText(text), 'https://codeforces.com/problemset/problem/1/A');
		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('Ссылка на задачу').focus();
		await page.keyboard.press('ControlOrMeta+V');
		await dialog.getByLabel('Название', { exact: true }).fill('Theatre Square');
		await dialog.getByLabel('Сложность').selectOption('easy');
		await dialog.getByLabel('Темы', { exact: true }).fill('Математика');
		await expect(dialog.getByRole('status')).toHaveCount(0);
		await dialog.getByRole('button', { name: 'Сохранить задачу', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Theatre Square', exact: true })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Codeforces ↗', exact: true })).toHaveAttribute('href', 'https://codeforces.com/problemset/problem/1/A');
		expect(looked).toBe(false);
	});
});

const fieldButtons = [
	{ name: 'aligns the link button with the set field', role: 'parent', field: 'Набор', button: 'Привязать' },
	{ name: 'aligns the save button with the review date field', role: 'student', field: 'Следующее повторение', button: 'Сохранить попытку' },
] as const;
for (const row of fieldButtons) {
	test(row.name, async ({ page, notebook }) => {
		if (row.role === 'parent') await signIn(page, 'parent');
		await page.goto(`/leetcode/problems/${notebook.problem.id}`);
		await expect(page.getByLabel('Основная идея', { exact: true })).toBeVisible();
		await expect(page.getByText('Материалов пока нет.', { exact: true })).toBeVisible();
		const field = await page.getByLabel(row.field, { exact: true }).boundingBox();
		const button = await page.getByRole('button', { name: row.button, exact: true }).boundingBox();
		expect(Math.abs(field!.y + field!.height - (button!.y + button!.height))).toBeLessThanOrEqual(1);
	});
}
