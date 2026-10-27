import { readFileSync } from 'node:fs';
import type { Locator } from '@playwright/test';
import { test, expect, signIn } from './fixtures';

type Marked = Window & { kept?: boolean };

test('changes the page without a reload and keeps the history', async ({ page, notebook }) => {
	await page.goto('/leetcode');
	await page.evaluate(() => { (window as Marked).kept = true; });
	const problems = page.getByRole('navigation', { name: 'Тетрадь' }).getByRole('link', { name: 'Задачи', exact: true });
	await problems.click();
	await expect(page).toHaveURL(/\/leetcode\/problems$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Задачи' })).toBeVisible();
	await expect(problems).toHaveAttribute('aria-current', 'page');
	await page.getByRole('link', { name: notebook.problem.title }).first().click();
	await expect(page).toHaveURL(`/leetcode/problems/${notebook.problem.id}`);
	await page.goBack();
	await expect(page.getByRole('heading', { level: 1, name: 'Задачи' })).toBeVisible();
	await page.goBack();
	await expect(page.getByRole('heading', { level: 1, name: 'Стройте понимание, задача за задачей.' })).toBeVisible();
	await page.goForward();
	await expect(page.getByRole('heading', { level: 1, name: 'Задачи' })).toBeVisible();
	expect(await page.evaluate(() => (window as Marked).kept)).toBe(true);
});

test('shows the version of package.json after the name', async ({ page }) => {
	const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
	await signIn(page);
	await expect(page.getByRole('link', { name: `redlamp ${version} Тетрадь LeetCode`, exact: true })).toHaveAttribute('href', '/leetcode');
});

const navigation = [
	{ name: 'wide desktop student dark', width: 1440, role: 'student', theme: 'dark', enlarged: false },
	{ name: 'desktop parent light at 1001 px', width: 1001, role: 'parent', theme: 'light', enlarged: false },
	{ name: 'desktop student dark at 1000 px', width: 1000, role: 'student', theme: 'dark', enlarged: false },
	{ name: 'desktop parent light at 851 px', width: 851, role: 'parent', theme: 'light', enlarged: false },
	{ name: 'horizontal parent dark at 850 px', width: 850, role: 'parent', theme: 'dark', enlarged: false },
	{ name: 'horizontal student light at 621 px', width: 621, role: 'student', theme: 'light', enlarged: false },
	{ name: 'stacked parent light at 620 px', width: 620, role: 'parent', theme: 'light', enlarged: false },
	{ name: 'phone student dark at 390 px', width: 390, role: 'student', theme: 'dark', enlarged: false },
	{ name: 'phone parent light at 320 px', width: 320, role: 'parent', theme: 'light', enlarged: false },
	{ name: 'desktop with double-size text', width: 851, role: 'student', theme: 'dark', enlarged: true },
	{ name: 'phone with double-size text', width: 320, role: 'parent', theme: 'light', enlarged: true },
] as const;
const labelSize = (link: Locator) => link.evaluate(element => {
	const range = document.createRange();
	range.selectNodeContents(element.lastChild!);
	const box = element.getBoundingClientRect(), rects = [...range.getClientRects()];
	return { lines: new Set(rects.map(rect => rect.top)).size, height: box.height, contained: rects.every(rect => rect.left >= box.left && rect.right <= box.right && rect.top >= box.top && rect.bottom <= box.bottom) };
});
for (const row of navigation) {
	test(`homework navigation with Noto Sans: ${row.name}`, async ({ page }) => {
		await page.setViewportSize({ width: row.width, height: 1000 });
		await signIn(page, row.role);
		if (row.theme === 'light') await page.getByRole('button', { name: 'Светлая тема', exact: true }).click();
		await page.locator('.sidebar').evaluate((sidebar, size) => {
			sidebar.style.fontFamily = '"Noto Sans"';
			if (size) for (const link of sidebar.querySelectorAll<HTMLElement>('nav a')) link.style.fontSize = `${size}px`;
		}, row.enlarged ? row.width > 620 ? 26 : 22 : 0);
		const nav = page.getByRole('navigation', { name: 'Тетрадь' }), homework = nav.getByRole('link', { name: 'Домашняя работа', exact: true });
		const cdp = await page.context().newCDPSession(page);
		await cdp.send('DOM.enable');
		await cdp.send('CSS.enable');
		const { root } = await cdp.send('DOM.getDocument');
		const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'nav a[href="/leetcode/homework"]' });
		await expect.poll(async () => (await cdp.send('CSS.getPlatformFontsForNode', { nodeId })).fonts.map(font => font.familyName)).toEqual(['Noto Sans']);
		await expect(homework).not.toHaveAttribute('aria-current');
		await expect(homework).toHaveCSS('font-weight', '400');
		await homework.scrollIntoViewIfNeeded();
		const inactive = await labelSize(homework);
		expect(inactive.contained).toBe(true);
		await homework.hover();
		await expect(homework).toHaveCSS('background-color', row.theme === 'light' ? 'rgb(207, 207, 207)' : 'rgb(68, 68, 68)');
		await nav.getByRole('link', { name: 'Задачи', exact: true }).focus();
		await page.keyboard.press('Tab');
		await expect(homework).toBeFocused();
		await expect(homework).toHaveCSS('outline-style', 'dotted');
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL('/leetcode/homework');
		await expect(homework).toHaveAttribute('aria-current', 'page');
		await expect(homework).toHaveCSS('font-weight', '700');
		await expect(homework).toHaveCSS('background-color', 'rgb(243, 128, 32)');
		await expect(homework).toHaveCSS('outline-style', 'dotted');
		await expect(homework.locator('svg')).toBeVisible();
		const active = await labelSize(homework);
		expect(active.contained).toBe(true);
		if (row.width > 850 && !row.enlarged) {
			expect(inactive.lines).toBe(1);
			expect(active.lines).toBe(1);
			expect(active.height).toBe(inactive.height);
		}
		await expect(homework).toBeInViewport();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		if (!row.enlarged && [1000, 851, 390].includes(row.width)) await page.screenshot({ path: `.superpowers/screenshots/complexity-learning/navigation-${row.width}-${row.theme}.png`, fullPage: true });
	});
}
