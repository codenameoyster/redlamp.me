import { test, expect, signIn } from './fixtures';
import type { Page } from '@playwright/test';

// Answers card `number` of 8: a choice button, or a short answer in the text field.
async function answer(page: Page, number: number, value: string, short = false) {
	await expect(page.getByText(`Карточка ${number} из 8`, { exact: true })).toBeVisible();
	if (!short) return page.getByRole('button', { name: value, exact: true }).click();
	await page.getByLabel('Ваш ответ').fill(value);
	await page.getByRole('button', { name: 'Ответить', exact: true }).click();
}

test('passes a deck with 7 of 8 and waits an hour for the next attempt', async ({ page }) => {
	await signIn(page);
	await page.getByRole('link', { name: 'Квиз', exact: true }).click();
	const deck = page.getByRole('article').filter({ has: page.locator('h2 a[href="/leetcode/quiz/permutations-and-combinations-1"]') });
	await expect(deck.getByRole('heading')).toHaveText('Permutations и Combinations, глава 1');
	await expect(page.getByRole('article')).toHaveCount(13);
	await expect(deck.getByText('Не пройден', { exact: true })).toBeVisible();
	await deck.getByRole('link', { name: 'Начать', exact: true }).click();
	await expect(page.getByText('Карточка 1 из 8')).toBeVisible();
	// A graded round has no AI tutor.
	await expect(page.getByRole('button', { name: 'Спросить ИИ', exact: true })).toHaveCount(0);
	await answer(page, 1, '500'); // pc1-product-rule
	await answer(page, 2, '24'); // pc1-sum-rule, wrong
	await answer(page, 3, ' 48 ', true); // pc1-factorial
	await answer(page, 4, '126', true); // pc1-medals
	await answer(page, 5, '15'); // pc1-team, code
	await answer(page, 6, '66', true); // pc1-symmetry
	await answer(page, 7, '31', true); // pc1-subsets
	await answer(page, 8, '720'); // pc1-order-matters
	await expect(page.getByRole('heading', { name: 'Верных ответов: 7 из 8. Квиз засчитан.', exact: true })).toBeVisible();
	const sum = page.getByRole('article').filter({ hasText: 'В столовой 3 супа' });
	await expect(sum).toContainText('Ваш ответ: 24');
	await expect(sum).toContainText('Правильный ответ: 20');
	await expect(sum).toContainText('Product Rule: суп и второе дают 3 · 4 = 12, второе и десерт дают 4 · 2 = 8. Sum Rule: 12 + 8 = 20.');
	await expect(page.getByRole('article')).toHaveCount(8);
	await expect(page.getByText('Повтор через', { exact: false })).toHaveCount(0);
	await expect(page.getByText(/^Следующая попытка после \d\d:\d\d\.$/)).toBeVisible();
	await page.getByRole('link', { name: 'Квиз', exact: true }).click();
	await expect(deck.getByText('Пройден: 7 из 8', { exact: true })).toBeVisible();
	await expect(deck.getByText(/^Следующая попытка после \d\d:\d\d$/)).toBeVisible();
	await expect(deck.getByRole('link', { name: 'Начать' })).toHaveCount(0);
	await deck.getByRole('link', { name: 'Permutations и Combinations, глава 1', exact: true }).click();
	await expect(page.getByText(/^Следующая попытка после \d\d:\d\d\.$/)).toBeVisible();
	await expect(page.getByText(/^Карточка \d/)).toHaveCount(0);
	await page.goto('/leetcode/sets/permutations-and-combinations');
	await expect(page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Считаем варианты', exact: true }) })).toContainText(/Квиз\. Пройден: 7 из 8\. Следующая попытка после \d\d:\d\d/);
	await page.goto('/leetcode/sets/permutations-and-combinations/1');
	await expect(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Квиз главы', exact: true }) })).toContainText(/Пройден: 7 из 8\. Следующая попытка после \d\d:\d\d/);
	await page.getByRole('link', { name: 'Сегодня', exact: true }).click();
	await expect(page.getByText('14 XP. До уровня 2: 86 XP.', { exact: true })).toBeVisible();
	await expect(page.getByText('Карточки квиза')).toHaveCount(0);
});

test('a failed attempt shows the wrong cards without the answers and gives no XP', async ({ page }) => {
	await signIn(page);
	await page.goto('/leetcode/quiz/permutations-and-combinations-1');
	// The second click of a double click does not answer the next card.
	await page.getByRole('button', { name: '500', exact: true }).dblclick();
	await answer(page, 2, '24'); // wrong
	await expect(page.getByText('Карточка 3 из 8', { exact: true })).toBeVisible();
	await page.getByLabel('Ваш ответ').fill('  ');
	await expect(page.getByRole('button', { name: 'Ответить', exact: true })).toBeDisabled();
	await answer(page, 3, '48', true);
	await answer(page, 4, '1', true); // wrong
	await answer(page, 5, '15');
	await answer(page, 6, '66', true);
	await answer(page, 7, '32', true); // wrong
	await answer(page, 8, '720');
	await expect(page.getByRole('heading', { name: 'Верных ответов: 5 из 8. Квиз не засчитан.', exact: true })).toBeVisible();
	await expect(page.getByRole('article')).toHaveCount(3);
	await expect(page.getByRole('article').filter({ hasText: 'В столовой 3 супа' })).toBeVisible();
	await expect(page.getByText('Правильный ответ', { exact: false })).toHaveCount(0);
	await expect(page.getByText('Product Rule: суп и второе дают 3 · 4 = 12', { exact: false })).toHaveCount(0);
	await page.getByRole('link', { name: 'Сегодня', exact: true }).click();
	await expect(page.getByText('0 XP. До уровня 2: 100 XP.', { exact: true })).toBeVisible();
});

test('marks the first hard word of a card prompt and of its explanation, and not the options', async ({ page }) => {
	await signIn(page);
	await page.route('**/leetcode/api/quiz/heaps-and-queues-1', route => route.fulfill({ json: { title: 'Heap (Priority Queue), Queue и Deque, глава 1', nextAt: null, cards: [{ id: 'test-deque', type: 'choice', prompt: 'В Deque q три числа. Что вернёт q.pop()?', options: ['Число из Deque', 'Ничего'] }] } }));
	await page.route('**/leetcode/api/quiz/heaps-and-queues-1/attempts', route => route.fulfill({ json: { correct: 1, total: 1, passed: true, nextAt: '2026-10-14T12:00:00.000Z', results: [{ cardId: 'test-deque', correct: true, answer: 'Число из Deque', explain: 'Deque отдаёт число с конца, а пустой Deque даёт ошибку.' }] } }));
	await page.goto('/leetcode/quiz/heaps-and-queues-1');
	await expect(page.locator('.quiz-card .term')).toHaveText(['Deque']);
	await page.getByRole('button', { name: 'Число из Deque', exact: true }).click();
	await expect(page.getByRole('article').locator('.term')).toHaveText(['Deque', 'Deque']);
});

test('the parent reads the deck with answers', async ({ page }) => {
	await signIn(page, 'parent');
	await page.goto('/leetcode/quiz/permutations-and-combinations-1');
	await expect(page.getByRole('heading', { name: 'Permutations и Combinations, глава 1', level: 1 })).toBeVisible();
	await expect(page.getByText('Ответ: 48')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Ответить' })).toHaveCount(0);
});
