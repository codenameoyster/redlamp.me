import { test, expect, signIn } from './fixtures';
import type { Page } from '@playwright/test';
import type { Homework, Problem } from '../shared/leetcode';

const setPath = '/leetcode/sets/permutations-and-combinations';
function row(page: Page, title: string) { return page.getByRole('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) }); }

test('assigns set tasks to new and existing homework', async ({ page, context }) => {
	await signIn(page, 'parent');
	await page.getByRole('link', { name: 'Наборы', exact: true }).click();
	await page.getByRole('link', { name: 'Permutations and combinations', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Permutations and combinations', level: 1 })).toBeVisible();
	await expect(page.frameLocator('iframe').getByRole('heading', { level: 1 })).toHaveText('Permutations and combinations');
	await context.route('https://www.techinterviewhandbook.org/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Reading</p>' }));
	const reading = page.getByRole('link', { name: 'Recursion cheatsheet', exact: true });
	await expect(reading).toHaveAttribute('rel', 'noopener noreferrer');
	const [tab] = await Promise.all([context.waitForEvent('page'), reading.click()]);
	await expect(tab).toHaveURL('https://www.techinterviewhandbook.org/algorithms/recursion/');
	await tab.close();
	const subsets = row(page, 'Subsets');
	await subsets.getByRole('button', { name: 'Добавить в домашнюю работу', exact: true }).click();
	const first = page.getByRole('dialog', { name: 'Добавить «Subsets» в домашнюю работу' });
	await expect(first.getByLabel('Название', { exact: true })).toHaveValue('Permutations and combinations');
	await first.getByLabel('Название', { exact: true }).fill('Week 41: backtracking');
	await first.getByLabel('Срок', { exact: true }).fill('2026-10-20');
	await first.getByRole('button', { name: 'Создать и назначить', exact: true }).click();
	await expect(first).toHaveCount(0);
	await expect(subsets.getByRole('link', { name: 'Назначено', exact: true })).toHaveAttribute('href', /^\/leetcode\/tasks\/[a-f0-9-]{36}$/);
	await expect(subsets.getByRole('link', { name: 'Subsets', exact: true })).toHaveAttribute('href', /^\/leetcode\/problems\/[a-f0-9-]{36}$/);
	await expect(subsets.getByRole('button', { name: 'Добавить в домашнюю работу' })).toHaveCount(0);
	const permutations = row(page, 'Permutations'), add = permutations.getByRole('button', { name: 'Добавить в домашнюю работу', exact: true });
	await expect(permutations.getByRole('link', { name: 'Permutations', exact: true })).toHaveAttribute('href', 'https://leetcode.com/problems/permutations/');
	await add.click();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(add).toBeFocused();
	await add.click();
	const second = page.getByRole('dialog', { name: 'Добавить «Permutations» в домашнюю работу' }), bundle = second.getByRole('article').filter({ hasText: 'Week 41: backtracking' });
	await expect(bundle).toContainText('Срок: 2026-10-20');
	await expect(bundle).toContainText('1 задание');
	let release!: () => void, entered!: () => void;
	const held = new Promise<void>(resolve => { release = resolve; }), pending = new Promise<void>(resolve => { entered = resolve; });
	await page.route(url => url.searchParams.get('q') === 'graphs', async route => { entered(); await held; await route.continue(); }, { times: 1 });
	await second.getByRole('searchbox', { name: 'Найти домашнюю работу', exact: true }).fill('graphs');
	await pending;
	await expect(bundle).toBeVisible();
	release();
	await expect(second.getByText('Нет подходящей активной домашней работы.', { exact: true })).toBeVisible();
	await expect(bundle).toHaveCount(0);
	await second.getByRole('searchbox', { name: 'Найти домашнюю работу', exact: true }).fill('BACKTRACKING');
	await bundle.getByRole('button', { name: 'Назначить', exact: true }).click();
	await expect(second).toHaveCount(0);
	await expect(permutations.getByRole('link', { name: 'Назначено', exact: true })).toHaveAttribute('href', /^\/leetcode\/tasks\/[a-f0-9-]{36}$/);
	await page.getByRole('link', { name: 'Задачи', exact: true }).click();
	const library = page.getByRole('region', { name: 'Библиотека задач' });
	await expect(library.getByRole('link', { name: 'Subsets', exact: true })).toBeVisible();
	await expect(library.getByRole('link', { name: 'Permutations', exact: true })).toBeVisible();
	expect(await (await page.request.get('/leetcode/api/problems?q=subsets')).json()).toMatchObject({ items: [{ url: 'https://leetcode.com/problems/subsets/', number: 78, title: 'Subsets', difficulty: 'medium', topics: ['Array', 'Backtracking', 'Bit Manipulation'], summary: 'Save the path at every node of the tree, not only at the leaves. Expect 2^n results and save a copy with path[:].' }] });
	await page.getByRole('link', { name: 'Домашняя работа', exact: true }).click();
	await expect(page.getByText('0 из 2 завершено', { exact: true })).toBeVisible();
	await signIn(page);
	await page.goto(setPath);
	await expect(row(page, 'Subsets').getByRole('link', { name: 'Назначено', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Добавить в домашнюю работу' })).toHaveCount(0);
});

test('shows a task conflict in the dialog', async ({ page, baseURL }) => {
	const headers = { Origin: new URL(baseURL!).origin };
	await signIn(page, 'parent');
	await page.goto(setPath);
	const add = row(page, 'Subsets').getByRole('button', { name: 'Добавить в домашнюю работу', exact: true });
	await expect(add).toBeVisible();
	const homework = await (await page.request.post('/leetcode/api/homework', { headers, data: { title: 'Week 41', instructions: '', dueDate: null } })).json() as Homework;
	const problem = await (await page.request.post('/leetcode/api/problems', { headers, data: { url: 'https://leetcode.com/problems/subsets/', number: 78, title: 'Subsets', difficulty: 'medium', topics: [], summary: '' } })).json() as Problem;
	expect((await page.request.post('/leetcode/api/tasks', { headers, data: { homeworkId: homework.id, problemId: problem.id } })).status()).toBe(201);
	await add.click();
	const dialog = page.getByRole('dialog', { name: 'Добавить «Subsets» в домашнюю работу' });
	await dialog.getByRole('article').filter({ hasText: 'Week 41' }).getByRole('button', { name: 'Назначить', exact: true }).click();
	await expect(dialog.getByRole('alert')).toHaveText('У этой задачи уже есть активное задание. Сначала завершите или отмените его.');
	await dialog.getByLabel('Название', { exact: true }).fill('Week 42');
	await dialog.getByRole('button', { name: 'Создать и назначить', exact: true }).click();
	await expect(dialog.getByRole('article').filter({ hasText: 'Week 42' })).toContainText('0 заданий');
	await expect(dialog.getByRole('alert')).toHaveText('У этой задачи уже есть активное задание. Сначала завершите или отмените его.');
});

test('does not create homework for an archived problem', async ({ page, baseURL }) => {
	const headers = { Origin: new URL(baseURL!).origin };
	await signIn(page, 'parent');
	const problem = await (await page.request.post('/leetcode/api/problems', { headers, data: { url: 'https://leetcode.com/problems/subsets/', number: 78, title: 'Subsets', difficulty: 'medium', topics: [], summary: '' } })).json() as Problem;
	expect((await page.request.post(`/leetcode/api/problems/${problem.id}/archive`, { headers, data: { version: problem.version } })).status()).toBe(200);
	await page.goto(setPath);
	await row(page, 'Subsets').getByRole('button', { name: 'Добавить в домашнюю работу', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Добавить «Subsets» в домашнюю работу' });
	await dialog.getByRole('button', { name: 'Создать и назначить', exact: true }).click();
	await expect(dialog.getByRole('alert')).toHaveText('Верните задачу из архива, прежде чем назначать её.');
	expect(await (await page.request.get('/leetcode/api/homework')).json()).toMatchObject({ items: [] });
});

test('fits the set pages at the mobile width', async ({ page }, testInfo) => {
	await page.setViewportSize(testInfo.config.projects.find(project => project.name === 'mobile')!.use.viewport!);
	await signIn(page, 'parent');
	await page.goto('/leetcode/sets');
	await expect(page.getByRole('link', { name: 'Permutations and combinations', exact: true })).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.goto(setPath);
	await row(page, 'Subsets').getByRole('button', { name: 'Добавить в домашнюю работу', exact: true }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	expect(await page.getByRole('dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth)).toBe(true);
});

test('links a set as a related lesson of a problem', async ({ page, notebook }) => {
	await signIn(page, 'parent');
	await page.goto(`/leetcode/problems/${notebook.problem.id}`);
	await page.getByRole('combobox', { name: 'Связанный урок', exact: true }).selectOption({ label: 'Permutations and combinations' });
	await page.getByRole('button', { name: 'Привязать', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Отвязать Permutations and combinations', exact: true })).toBeVisible();
	await page.getByRole('link', { name: 'Permutations and combinations', exact: true }).click();
	await expect(page).toHaveURL(setPath);
});
