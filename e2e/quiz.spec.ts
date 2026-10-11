import { test, expect, signIn } from './fixtures';

test('plays a round and sees the counts change', async ({ page }) => {
	await signIn(page);
	await page.getByRole('link', { name: 'Quiz', exact: true }).click();
	const deck = page.getByRole('article').filter({ hasText: 'Permutations and combinations' }), result = page.getByRole('status', { name: 'Result' });
	await expect(deck.getByText('0 due')).toBeVisible();
	await expect(deck.getByText('26 new')).toBeVisible();
	await deck.getByRole('link', { name: 'Start', exact: true }).click();
	await expect(page.getByText('Card 1 of 10')).toBeVisible();
	await page.getByRole('button', { name: '12', exact: true }).click(); // pc-product-rule
	await expect(result).toContainText('Correct. +2 XP. Again in 3 days.');
	await page.getByRole('button', { name: 'Next card', exact: true }).click();
	await page.getByRole('button', { name: '6', exact: true }).click(); // pc-sum-rule, wrong
	await expect(result).toContainText('Not yet. The answer is 5.');
	await expect(page.getByText('The sum rule: choices that exclude each other add. 3 + 2 = 5.')).toBeVisible();
	await page.getByRole('button', { name: 'Next card', exact: true }).click();
	await page.getByLabel('Your answer').fill(' 120 '); // pc-factorial
	await page.getByRole('button', { name: 'Check', exact: true }).click();
	await expect(result).toContainText('Correct.');
	await page.getByRole('button', { name: 'Next card', exact: true }).click();
	await page.getByLabel('Your answer').fill('60'); // pc-perm-k
	await page.getByRole('button', { name: 'Check', exact: true }).click();
	await page.getByRole('button', { name: 'Next card', exact: true }).click();
	await page.getByLabel('Your answer').fill('10'); // pc-choose
	await page.getByRole('button', { name: 'Check', exact: true }).click();
	await page.getByRole('button', { name: 'Next card', exact: true }).click();
	await page.getByRole('button', { name: 'Show answer', exact: true }).click(); // pc-symmetry, flip
	await expect(page.getByText('C(n, k) = C(n, n - k)', { exact: false })).toBeVisible();
	await page.getByRole('button', { name: 'Got it', exact: true }).click();
	await expect(result).toContainText('Correct. +2 XP. Again in 3 days.');
	await page.getByRole('button', { name: 'Next card', exact: true }).click();
	await page.getByLabel('Your answer').fill('16'); // pc-subsets-count
	await page.getByRole('button', { name: 'Check', exact: true }).click();
	await page.getByRole('button', { name: 'Next card', exact: true }).click();
	await page.getByRole('button', { name: 'Pick a gold, a silver and a bronze winner from 8 runners', exact: true }).click(); // pc-order-matters
	await page.getByRole('button', { name: 'Next card', exact: true }).click();
	await page.getByRole('button', { name: 'Show answer', exact: true }).click(); // pc-template, flip
	await page.getByRole('button', { name: 'Not yet', exact: true }).click();
	await expect(result).toContainText('Not yet.');
	await page.getByRole('button', { name: 'Next card', exact: true }).click();
	await expect(page.getByText('path.pop()', { exact: false })).toBeVisible(); // pc-undo, code
	await page.getByRole('button', { name: 'used[i] = False', exact: true }).click();
	await expect(result).toContainText('Correct.');
	await page.getByRole('button', { name: 'Next card', exact: true }).click();
	await expect(page.getByText('You got 8 of 10.')).toBeVisible();
	await page.getByRole('link', { name: 'Stop', exact: true }).click();
	await expect(deck.getByText('16 new')).toBeVisible();
	await page.getByRole('link', { name: 'Today', exact: true }).click();
	await expect(page.getByRole('article').filter({ hasText: 'Quiz cards' }).getByText('0 due')).toBeVisible();
});

test('the parent reads the deck with answers', async ({ page }) => {
	await signIn(page, 'parent');
	await page.goto('/leetcode/quiz/permutations-and-combinations');
	await expect(page.getByRole('heading', { name: 'Permutations and combinations', level: 1 })).toBeVisible();
	await expect(page.getByText('Answer: 120')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Check' })).toHaveCount(0);
});
