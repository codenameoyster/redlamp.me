import { test, expect, signIn, type TestEnv } from './fixtures';

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

test('keeps the latest selection when the other download finishes', async ({ page }) => {
	await signIn(page);
	const original = page.getByRole('group', { name: 'Бомжарня', exact: true }), added = page.getByRole('group', { name: 'Жирчевня', exact: true });
	let release!: () => void;
	const held = new Promise<void>(resolve => { release = resolve; });
	await page.route('**/leetcode/assets/zhirchevnya.mp3', async route => { await held; await route.continue(); });
	try {
		await Promise.all([page.waitForRequest('**/leetcode/assets/zhirchevnya.mp3'), added.getByRole('button', { name: 'Включить мелодию', exact: true }).click()]);
		await original.getByRole('button', { name: 'Включить мелодию', exact: true }).click();
		await expect.poll(() => original.locator('audio').evaluate((element: HTMLAudioElement) => element.paused)).toBe(false);
		release();
		await expect.poll(() => added.locator('audio').evaluate((element: HTMLAudioElement) => element.readyState)).toBeGreaterThanOrEqual(2);
		const time = await original.locator('audio').evaluate((element: HTMLAudioElement) => element.currentTime);
		await expect.poll(() => original.locator('audio').evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(time + 0.3);
		expect(await added.locator('audio').evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
		await added.getByRole('button', { name: 'Включить мелодию', exact: true }).click();
		await expect.poll(() => added.locator('audio').evaluate((element: HTMLAudioElement) => element.paused)).toBe(false);
		await expect.poll(() => original.locator('audio').evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
	} finally { release(); }
});

for (const width of [390, 760]) test(`keeps pagination clickable above the players at ${width}px`, async ({ page, server }) => {
	await page.setViewportSize({ width, height: 844 });
	const { DB } = await server.getWorker<TestEnv>().getEnv();
	await DB.batch(Array.from({ length: 21 }, (_, i) => DB.prepare("INSERT INTO problems (id,slug,title,difficulty,topics,summary,search_text,created_at,updated_at) VALUES (?,?,?,'easy','[]','','','now','now')").bind(crypto.randomUUID(), `music-layout-${i}`, `Problem ${i}`)));
	await signIn(page);
	await page.goto('/leetcode/problems?limit=20');
	const next = page.getByRole('link', { name: 'Ещё задачи', exact: true });
	await expect(next).toBeVisible();
	await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
	await next.click({ timeout: 1500 });
	await expect(page).toHaveURL(/offset=20/);
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
