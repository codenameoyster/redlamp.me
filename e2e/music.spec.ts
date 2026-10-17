import { test, expect, signIn } from './fixtures';

for (const [title, position] of [['Бомжарня', '0:11 / 0:23'], ['Жирчевня', '1:32 / 3:04']]) test(`plays ${title} across page changes`, async ({ page, notebook }) => {
	await page.goto('/leetcode');
	const music = page.getByRole('group', { name: title, exact: true }), audio = music.locator('audio'), paused = () => audio.evaluate((element: HTMLAudioElement) => element.paused);
	await music.getByRole('button', { name: 'Включить мелодию', exact: true }).click();
	await expect.poll(paused).toBe(false);
	await page.getByRole('link', { name: 'Открыть задачи', exact: true }).click();
	await expect(page.getByRole('link', { name: notebook.problem.title }).first()).toBeVisible();
	expect(await paused()).toBe(false);
	await music.getByRole('button', { name: 'Выключить мелодию', exact: true }).click();
	await expect.poll(paused).toBe(true);
	const seek = music.getByLabel('Позиция в мелодии', { exact: true });
	await seek.fill('500');
	await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => Math.round(element.currentTime / element.duration * 100))).toBe(50);
	await seek.hover();
	await expect(music.getByText(position, { exact: true })).toHaveCSS('opacity', '1');
	await expect(music.getByText('Bibik', { exact: true })).toHaveCSS('opacity', '0');
});

test('pauses the other track when switching players', async ({ page }) => {
	await signIn(page);
	const original = page.getByRole('group', { name: 'Бомжарня', exact: true }), added = page.getByRole('group', { name: 'Жирчевня', exact: true });
	await original.getByRole('button', { name: 'Включить мелодию', exact: true }).click();
	await expect.poll(() => original.locator('audio').evaluate((element: HTMLAudioElement) => element.paused)).toBe(false);
	await added.getByRole('button', { name: 'Включить мелодию', exact: true }).click();
	await expect.poll(() => added.locator('audio').evaluate((element: HTMLAudioElement) => element.paused)).toBe(false);
	await expect.poll(() => original.locator('audio').evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
	await original.getByRole('button', { name: 'Включить мелодию', exact: true }).click();
	await expect.poll(() => original.locator('audio').evaluate((element: HTMLAudioElement) => element.paused)).toBe(false);
	await expect.poll(() => added.locator('audio').evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
	await expect(added.getByRole('button', { name: 'Включить мелодию', exact: true })).toBeVisible();
});

test('tells when the melody does not start', async ({ page }) => {
	await signIn(page);
	const music = page.getByRole('group', { name: 'Бомжарня', exact: true });
	await page.route('**/leetcode/assets/melody.mp3', route => route.fulfill({ status: 404 }));
	await music.getByRole('button', { name: 'Включить мелодию', exact: true }).click();
	await expect(music.getByText('Мелодия не включилась', { exact: true })).toBeVisible();
	await expect(music.getByRole('button', { name: 'Включить мелодию', exact: true })).toBeVisible();
});

test('starts the melody once on a double click during the load', async ({ page }) => {
	await signIn(page);
	const music = page.getByRole('group', { name: 'Бомжарня', exact: true });
	await page.route('**/leetcode/assets/melody.mp3', async route => { await new Promise(resolve => setTimeout(resolve, 300)); await route.continue(); });
	await music.getByRole('button', { name: 'Включить мелодию', exact: true }).dblclick();
	await expect.poll(() => music.locator('audio').evaluate((element: HTMLAudioElement) => element.paused)).toBe(false);
	await expect(music.getByText('Мелодия не включилась', { exact: true })).toHaveCount(0);
});

test('logs out while the melody plays without a page error', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await signIn(page);
	const music = page.getByRole('group', { name: 'Бомжарня', exact: true });
	await music.getByRole('button', { name: 'Включить мелодию', exact: true }).click();
	await expect.poll(() => music.locator('audio').evaluate((element: HTMLAudioElement) => element.paused)).toBe(false);
	await page.getByRole('button', { name: 'Выйти', exact: true }).click();
	await expect(page).toHaveURL(/\/leetcode\/login$/);
	expect(errors).toEqual([]);
});
