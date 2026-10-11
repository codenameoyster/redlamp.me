import { test, expect, signIn } from './fixtures';

test('plays a round and sees the counts change', async ({ page }) => {
	await signIn(page);
	await page.getByRole('link', { name: 'Квиз', exact: true }).click();
	const deck = page.getByRole('article').filter({ hasText: 'Permutations and combinations, глава 1' }), second = page.getByRole('article').filter({ hasText: 'Permutations and combinations, глава 2' }), result = page.getByRole('status', { name: 'Результат' });
	await expect(page.getByRole('article')).toHaveCount(4);
	await expect(deck.getByText('К повторению: 0')).toBeVisible();
	await expect(deck.getByText('Новых: 8')).toBeVisible();
	await expect(page.getByRole('article').filter({ hasText: 'глава 3' }).getByText('Новых: 6')).toBeVisible();
	await expect(page.getByRole('article').filter({ hasText: 'глава 4' }).getByText('Новых: 4')).toBeVisible();
	await deck.getByRole('link', { name: 'Начать', exact: true }).click();
	await expect(page.getByText('Карточка 1 из 8')).toBeVisible();
	await page.getByRole('button', { name: 'Спросить ИИ', exact: true }).click();
	const panel = page.getByRole('dialog', { name: 'ИИ-репетитор' });
	await expect(panel.getByText('Спросите об этой странице. Репетитор даёт подсказки, а не полные решения.', { exact: true })).toBeVisible();
	await panel.getByRole('button', { name: 'Закрыть', exact: true }).click();
	await page.getByRole('button', { name: '12', exact: true }).click(); // pc-product-rule
	await expect(result).toContainText('Верно. +2 XP. Повтор через 3 дн.');
	await page.getByRole('button', { name: 'Следующая карточка', exact: true }).click();
	await page.getByRole('button', { name: '6', exact: true }).click(); // pc-sum-rule, wrong
	await expect(result).toContainText('Пока нет. Ответ: 5.');
	await expect(page.getByText('The sum rule: choices that exclude each other add. 3 + 2 = 5.')).toBeVisible();
	await page.getByRole('button', { name: 'Следующая карточка', exact: true }).click();
	await page.getByLabel('Ваш ответ').fill(' 120 '); // pc-factorial
	await page.getByRole('button', { name: 'Проверить', exact: true }).click();
	await expect(result).toContainText('Верно.');
	await page.getByRole('button', { name: 'Следующая карточка', exact: true }).click();
	await page.getByLabel('Ваш ответ').fill('60'); // pc-perm-k
	await page.getByRole('button', { name: 'Проверить', exact: true }).click();
	await page.getByRole('button', { name: 'Следующая карточка', exact: true }).click();
	await page.getByLabel('Ваш ответ').fill('10'); // pc-choose
	await page.getByRole('button', { name: 'Проверить', exact: true }).click();
	await page.getByRole('button', { name: 'Следующая карточка', exact: true }).click();
	await page.getByRole('button', { name: 'Показать ответ', exact: true }).click(); // pc-symmetry, flip
	await expect(page.getByText('C(n, k) = C(n, n - k)', { exact: false })).toBeVisible();
	await page.getByRole('button', { name: 'Знаю', exact: true }).click();
	await expect(result).toContainText('Верно. +2 XP. Повтор через 3 дн.');
	await page.getByRole('button', { name: 'Следующая карточка', exact: true }).click();
	await page.getByLabel('Ваш ответ').fill('16'); // pc-subsets-count
	await page.getByRole('button', { name: 'Проверить', exact: true }).click();
	await page.getByRole('button', { name: 'Следующая карточка', exact: true }).click();
	await page.getByRole('button', { name: 'Pick a gold, a silver and a bronze winner from 8 runners', exact: true }).click(); // pc-order-matters
	await page.getByRole('button', { name: 'Следующая карточка', exact: true }).click();
	await expect(page.getByText('Верных ответов: 7 из 8.')).toBeVisible();
	await page.getByRole('link', { name: 'Закончить', exact: true }).click();
	await expect(deck.getByText('Новых: 0')).toBeVisible();
	await expect(second.getByText('Новых: 8')).toBeVisible();
	await second.getByRole('link', { name: 'Начать', exact: true }).click();
	await expect(page.getByText('Карточка 1 из 8')).toBeVisible();
	await page.getByRole('button', { name: 'Показать ответ', exact: true }).click(); // pc-template, flip
	await page.getByRole('button', { name: 'Ещё нет', exact: true }).click();
	await expect(result).toContainText('Пока нет.');
	await page.getByRole('button', { name: 'Следующая карточка', exact: true }).click();
	await expect(page.getByText('path.pop()', { exact: false })).toBeVisible(); // pc-undo, code
	await page.getByRole('button', { name: 'used[i] = False', exact: true }).click();
	await expect(result).toContainText('Верно.');
	await page.getByRole('link', { name: 'Квиз', exact: true }).click();
	await expect(second.getByText('К повторению: 0')).toBeVisible();
	await expect(second.getByText('Новых: 6')).toBeVisible();
	await page.getByRole('link', { name: 'Сегодня', exact: true }).click();
	await expect(page.getByRole('article').filter({ hasText: 'Карточки квиза' }).getByText('0 к повторению')).toBeVisible();
});

test('the parent reads the deck with answers', async ({ page }) => {
	await signIn(page, 'parent');
	await page.goto('/leetcode/quiz/permutations-and-combinations-1');
	await expect(page.getByRole('heading', { name: 'Permutations and combinations, глава 1', level: 1 })).toBeVisible();
	await expect(page.getByText('Ответ: 120')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Проверить' })).toHaveCount(0);
});
