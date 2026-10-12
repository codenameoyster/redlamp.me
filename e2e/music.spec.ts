import { test, expect } from './fixtures';

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
	await page.getByLabel('Позиция в мелодии', { exact: true }).fill('500');
	await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => Math.round(element.currentTime / element.duration * 100))).toBe(50);
});
