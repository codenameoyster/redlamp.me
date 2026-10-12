import { test, expect, signIn } from './fixtures';

test('plays the melody across page changes', async ({ page, notebook }) => {
	await page.goto('/leetcode');
	const audio = page.locator('audio'), paused = () => audio.evaluate((element: HTMLAudioElement) => element.paused);
	await page.getByRole('button', { name: 'Включить мелодию', exact: true }).click();
	await expect.poll(paused).toBe(false);
	await page.getByRole('link', { name: 'Открыть задачи', exact: true }).click();
	await expect(page.getByRole('link', { name: notebook.problem.title }).first()).toBeVisible();
	expect(await paused()).toBe(false);
	await page.getByRole('button', { name: 'Выключить мелодию', exact: true }).click();
	await expect.poll(paused).toBe(true);
	const seek = page.getByLabel('Позиция в мелодии', { exact: true });
	await seek.fill('500');
	await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => Math.round(element.currentTime / element.duration * 100))).toBe(50);
	// The melody is 23.46 s long, so the middle is 0:11.
	await seek.hover();
	await expect(page.getByText('0:11 / 0:23', { exact: true })).toHaveCSS('opacity', '1');
	await expect(page.getByText('Bibik', { exact: true })).toHaveCSS('opacity', '0');
});

test('tells when the melody does not start', async ({ page }) => {
	await signIn(page);
	await page.route('**/leetcode/assets/melody.mp3', route => route.fulfill({ status: 404 }));
	await page.getByRole('button', { name: 'Включить мелодию', exact: true }).click();
	await expect(page.getByText('Мелодия не включилась', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Включить мелодию', exact: true })).toBeVisible();
});
