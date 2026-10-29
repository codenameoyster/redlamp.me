import { test, expect, signIn } from './fixtures';

const title = 'Как понять O(n): время и память', chapterPath = '/leetcode/sets/complexity/1';
// The scan makes n - 1 comparisons. Four values have 3 + 2 + 1 pairs.
const answers = [
	{ name: 'eight values need seven comparisons', id: 'scan-count', answer: '7' },
	{ name: 'one scan takes linear time', id: 'scan-time', answer: ' o ( N ) ' },
	{ name: 'scan variables use constant memory', id: 'scan-memory', answer: 'O(1)' },
	{ name: 'Cyrillic O in a memory answer', id: 'scan-memory', answer: 'О(1)' },
	{ name: 'a list copy uses linear memory', id: 'copy-memory', answer: 'O(n)' },
	{ name: 'two separate scans take linear time', id: 'passes-time', answer: 'O(n)' },
	{ name: 'four values have six pairs', id: 'pairs-count', answer: '6' },
	{ name: 'all pairs take quadratic time', id: 'pairs-time', answer: 'O(n²)' },
	{ name: 'two inward pointers take linear time', id: 'pointers-time', answer: 'O(n)' },
];

test('opens complexity practice from the learning sets and checks every answer', async ({ page }) => {
	await signIn(page);
	await page.getByRole('link', { name: 'Бомжарня', exact: true }).click();
	await page.getByRole('link', { name: title, exact: true }).click();
	await page.getByRole('link', { name: 'Открыть главу', exact: true }).click();
	await expect(page).toHaveURL(chapterPath);
	await expect(page.locator('article.lesson pre code').filter({ hasText: 'best = a[0]' })).toBeVisible();
	await expect(page.locator('article.lesson pre code').filter({ hasText: 'while l < r:' })).toBeVisible();
	for (const row of answers) await test.step(row.name, async () => {
		const exercise = page.locator(`[data-exercise="${row.id}"]`), input = exercise.getByRole('textbox');
		await expect(input).not.toHaveAccessibleName('');
		await input.fill(row.answer);
		await input.press('Enter');
		await expect(exercise.getByRole('status')).toContainText('Верно');
	});
});

test('gives a hint and accepts a corrected answer without changing other answers', async ({ page }) => {
	await signIn(page);
	await page.goto(chapterPath);
	const count = page.locator('[data-exercise="scan-count"]'), time = page.locator('[data-exercise="scan-time"]');
	const input = count.getByRole('textbox'), check = count.getByRole('button', { name: 'Проверить', exact: true }), status = count.getByRole('status');
	await expect(check).toBeDisabled();
	await input.fill('   ');
	await expect(check).toBeDisabled();
	await expect(status).toBeEmpty();
	await time.getByRole('textbox').fill('O(n)');
	await time.getByRole('button', { name: 'Проверить', exact: true }).click();
	await expect(time.getByRole('status')).toContainText('Верно');
	await input.fill('8');
	await check.click();
	await expect(status).not.toBeEmpty();
	await expect(status).not.toContainText('Верно');
	await expect(check).toBeEnabled();
	await input.fill('7');
	await expect(status).toBeEmpty();
	await input.press('Enter');
	await expect(status).toContainText('Верно');
	await expect(time.getByRole('textbox')).toHaveValue('O(n)');
	await expect(time.getByRole('status')).toContainText('Верно');
	const pairs = page.locator('[data-exercise="pairs-time"]');
	await pairs.getByRole('textbox').fill('O(n^2)');
	await pairs.getByRole('button', { name: 'Проверить', exact: true }).click();
	await expect(pairs.getByRole('status')).toContainText('Верно');
});

for (const row of [
	{ name: 'desktop', width: 1440, height: 1000 },
	{ name: 'phone', width: 390, height: 844 },
]) test(`keeps complexity answers inside the page on a ${row.name}`, async ({ page }) => {
	await page.setViewportSize({ width: row.width, height: row.height });
	await signIn(page);
	await page.goto(chapterPath);
	const exercise = page.locator('[data-exercise="pointers-time"]');
	await exercise.getByRole('textbox').fill('O(n)');
	await exercise.getByRole('button', { name: 'Проверить', exact: true }).click();
	await expect(exercise.getByRole('status')).toContainText('Верно');
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	expect(await page.locator('article.lesson').evaluate(article => article.scrollWidth <= article.clientWidth)).toBe(true);
	await page.screenshot({ path: `.superpowers/screenshots/complexity/${row.name}.png`, fullPage: true });
});

test('clears practice answers after leaving the chapter', async ({ page }) => {
	await signIn(page);
	await page.goto(chapterPath);
	const exercise = page.locator('[data-exercise="scan-count"]');
	await exercise.getByRole('textbox').fill('7');
	await exercise.getByRole('button', { name: 'Проверить', exact: true }).click();
	await expect(exercise.getByRole('status')).toContainText('Верно');
	await page.getByRole('link', { name: 'К набору', exact: true }).click();
	await page.getByRole('link', { name: 'Открыть главу', exact: true }).click();
	await expect(exercise.getByRole('textbox')).toHaveValue('');
	await expect(exercise.getByRole('status')).toBeEmpty();
});
