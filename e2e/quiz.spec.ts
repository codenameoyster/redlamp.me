import { test, expect, signIn } from './fixtures';

test('plays a round and sees the counts change', async ({ page }) => {
	await signIn(page);
	await page.getByRole('link', { name: 'Квиз', exact: true }).click();
	const deck = page.getByRole('article').filter({ hasText: 'Перестановки и сочетания, глава 1' }), second = page.getByRole('article').filter({ hasText: 'Перестановки и сочетания, глава 2' }), result = page.getByRole('status', { name: 'Результат' });
	await expect(page.getByRole('article')).toHaveCount(8);
	await expect(deck.getByText('К повторению: 0')).toBeVisible();
	await expect(deck.getByText('Новых: 8')).toBeVisible();
	await expect(page.getByRole('article').filter({ hasText: 'глава 3' }).getByText('Новых: 7')).toBeVisible();
	await expect(page.getByRole('article').filter({ hasText: 'глава 4' }).getByText('Новых: 6')).toBeVisible();
	await deck.getByRole('link', { name: 'Начать', exact: true }).click();
	await expect(page.getByText('Карточка 1 из 8')).toBeVisible();
	await page.getByRole('button', { name: 'Спросить ИИ', exact: true }).click();
	const panel = page.getByRole('dialog', { name: 'ИИ-репетитор' });
	await expect(panel.getByText('Спросите об этой странице. Репетитор даёт подсказки, а не полные решения.', { exact: true })).toBeVisible();
	await panel.getByRole('button', { name: 'Закрыть', exact: true }).click();
	await page.getByRole('button', { name: '500', exact: true }).click(); // pc1-product-rule
	await expect(result).toContainText('Верно. +2 XP. Повтор через 3 дн.');
	await page.getByRole('button', { name: 'Следующая карточка', exact: true }).click();
	await page.getByRole('button', { name: '24', exact: true }).click(); // pc1-sum-rule, wrong
	await expect(result).toContainText('Пока нет. Ответ: 20.');
	await expect(page.getByText('Суп и второе: 3 · 4 = 12.', { exact: false })).toBeVisible();
	await page.getByRole('button', { name: 'Следующая карточка', exact: true }).click();
	await page.getByLabel('Ваш ответ').fill(' 48 '); // pc1-factorial
	await page.getByRole('button', { name: 'Проверить', exact: true }).click();
	await expect(result).toContainText('Верно.');
	await page.getByRole('button', { name: 'Следующая карточка', exact: true }).click();
	await page.getByLabel('Ваш ответ').fill('126'); // pc1-medals
	await page.getByRole('button', { name: 'Проверить', exact: true }).click();
	await page.getByRole('button', { name: 'Следующая карточка', exact: true }).click();
	await page.getByRole('button', { name: '15', exact: true }).click(); // pc1-team, code
	await page.getByRole('button', { name: 'Следующая карточка', exact: true }).click();
	await page.getByLabel('Ваш ответ').fill('66'); // pc1-symmetry
	await page.getByRole('button', { name: 'Проверить', exact: true }).click();
	await expect(result).toContainText('Верно. +2 XP. Повтор через 3 дн.');
	await page.getByRole('button', { name: 'Следующая карточка', exact: true }).click();
	await page.getByLabel('Ваш ответ').fill('31'); // pc1-subsets
	await page.getByRole('button', { name: 'Проверить', exact: true }).click();
	await page.getByRole('button', { name: 'Следующая карточка', exact: true }).click();
	await page.getByRole('button', { name: '720', exact: true }).click(); // pc1-order-matters
	await page.getByRole('button', { name: 'Следующая карточка', exact: true }).click();
	await expect(page.getByText('Верных ответов: 7 из 8.')).toBeVisible();
	await page.getByRole('link', { name: 'Закончить', exact: true }).click();
	await expect(deck.getByText('Новых: 0')).toBeVisible();
	await expect(second.getByText('Новых: 8')).toBeVisible();
	await second.getByRole('link', { name: 'Начать', exact: true }).click();
	await expect(page.getByText('Карточка 1 из 8')).toBeVisible();
	await page.getByRole('button', { name: '[[], [1], [1, 2], [2]]', exact: true }).click(); // pc2-no-pop, wrong
	await expect(result).toContainText('Пока нет.');
	await page.getByRole('button', { name: 'Следующая карточка', exact: true }).click();
	await expect(page.getByText('if used[i]:', { exact: false })).toBeVisible(); // pc2-undo, code
	await page.getByRole('button', { name: '[[1, 2, 3]]', exact: true }).click();
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
	await expect(page.getByRole('heading', { name: 'Перестановки и сочетания, глава 1', level: 1 })).toBeVisible();
	await expect(page.getByText('Ответ: 48')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Проверить' })).toHaveCount(0);
});
