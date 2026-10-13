import { test, expect, signIn } from './fixtures';
import type { Page } from '@playwright/test';
import type { Figure, Homework, HomeworkTask, Problem } from '../shared/leetcode';
import twoPointers1 from '../src/leetcode/sets/two-pointers/chapter1';
import twoPointers2 from '../src/leetcode/sets/two-pointers/chapter2';

const setPath = '/leetcode/sets/permutations-and-combinations', chapterPath = `${setPath}/2`;
function row(page: Page, title: string) { return page.getByRole('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) }); }
const steps: Figure = { id: 'test-steps', title: 'Указатели идут навстречу', frames: [
	{ caption: 'l = 0, r = 3: 1 + 7 = 8, меньше 9.', rows: [{ cells: [1, 4, 5, 7], marked: [0, 3], pointers: { l: 0, r: 3 }, window: [0, 3] }] },
	{ caption: 'l = 1, r = 3: 4 + 7 = 11, больше 9.', rows: [{ cells: [1, 4, 5, 7], marked: [1, 3], dimmed: [0], pointers: { l: 1, r: 3 }, window: [1, 3] }] },
	{ caption: 'l = 1, r = 2: 4 + 5 = 9. Пара найдена.', rows: [{ cells: [1, 4, 5, 7], marked: [1, 2], dimmed: [0, 3], pointers: { l: 1, r: 2 }, window: [1, 2] }] },
] };
const single: Figure = { id: 'test-single', title: 'Один кадр', frames: [{ caption: 'Массив из трёх чисел.', rows: [{ label: 'a', cells: [2, 3, 5] }] }] };
const wide: Figure = { id: 'test-wide', title: 'Шестнадцать чисел', frames: [{ caption: 'Числа от 100 до 115.', rows: [{ label: 'nums', cells: [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115], pointers: { write: 0, read: 15 }, window: [0, 15] }] }] };
const heap: Figure = { id: 'test-heap', title: 'Куча в массиве', frames: [
	{ caption: 'Куча [1, 3, 2, 5, 9, 8]. Дети места 1: места 3 и 4.', rows: [{ label: 'куча', tree: true, cells: [1, 3, 2, 5, 9, 8], marked: [1, 3, 4] }, { label: 'h', cells: [1, 3, 2, 5, 9, 8], marked: [1, 3, 4] }] },
	{ caption: 'heappop заберёт 1 из корня.', rows: [{ label: 'куча', tree: true, cells: [1, 3, 2, 5, 9, 8], dimmed: [0] }, { label: 'h', cells: [1, 3, 2, 5, 9, 8], dimmed: [0] }] },
	{ caption: 'heappop забрал 1, число 8 спустилось на место 2. Место 5 пустое.', rows: [{ label: 'куча', tree: true, cells: [2, 3, 8, 5, 9, ''], marked: [0, 2] }, { label: 'h', cells: [2, 3, 8, 5, 9] }] },
] };
const wideHeap: Figure = { id: 'test-wide-heap', title: 'Куча кортежей', frames: [{ caption: 'Пятнадцать кортежей.', rows: [{ tree: true, cells: Array.from({ length: 15 }, (_, i) => `(${10 + i}, 1, 2)`) }] }] };
// Gives chapter 2 a lesson with these figures.
const lessonWith = (page: Page, figures: Figure[]) => page.route('**/leetcode/api/sets/permutations-and-combinations/lesson/2', route => route.fulfill({ json: { html: `<p class="lead">Урок с рисунками.</p>\n${figures.map(figure => `<figure data-figure="${figure.id}"></figure>`).join('\n')}\n<p>Текст после рисунков.</p>`, figures } }));
// Gives chapter 2 a lesson with these <pre> blocks.
const lessonCode = (page: Page, blocks: string[]) => page.route('**/leetcode/api/sets/permutations-and-combinations/lesson/2', route => route.fulfill({ json: { html: `<p class="lead">Урок с кодом.</p>\n${blocks.join('\n')}`, figures: [] } }));

test('assigns set tasks to new and existing homework', async ({ page, context }) => {
	await signIn(page, 'parent');
	await page.getByRole('link', { name: 'Бомжарня', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Бомжарня', level: 1 })).toBeVisible();
	await page.getByRole('link', { name: 'Перестановки и сочетания', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Перестановки и сочетания', level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Открыть главу', exact: true })).toHaveCount(4);
	await expect(row(page, 'Перебор: подмножества, перестановки, сочетания')).toContainText('Задач принято 0 из 5');
	await expect(row(page, 'Перебор: подмножества, перестановки, сочетания')).toContainText('Квиз. Не пройден');
	await page.getByRole('link', { name: 'Перебор: подмножества, перестановки, сочетания', exact: true }).click();
	await expect(page).toHaveURL(chapterPath);
	await expect(page.getByRole('heading', { name: 'Глава 2. Перебор: подмножества, перестановки, сочетания', level: 1 })).toBeVisible();
	await expect(page.locator('article.lesson').getByRole('heading', { name: '3. Рекурсия простыми словами', level: 2 })).toBeVisible();
	await expect(page.locator('article.lesson pre code .hljs-keyword').first()).toHaveText('def');
	const reading = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Где узнать больше', level: 2 }) }), link = reading.getByRole('link', { name: 'Перебор с возвратом: элементарные примеры', exact: true });
	await expect(reading.getByRole('listitem')).toHaveCount(4);
	await expect(reading.getByRole('listitem').last()).toHaveText('Полный перебор с рекурсией: подмножества, перестановки, ферзи USACO Guide (англ.)');
	await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
	await context.route('https://notes.algoprog.ru/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Reading</p>' }));
	const [tab] = await Promise.all([context.waitForEvent('page'), link.click()]);
	await expect(tab).toHaveURL('https://notes.algoprog.ru/ru/backtrack/01_1_elementary.html');
	await tab.close();
	await expect(page.getByRole('link', { name: 'Пройти квиз', exact: true })).toHaveAttribute('href', '/leetcode/quiz/permutations-and-combinations-2');
	await expect(page.getByRole('link', { name: 'Предыдущая глава', exact: true })).toHaveAttribute('href', `${setPath}/1`);
	await expect(page.getByRole('link', { name: 'Следующая глава', exact: true })).toHaveAttribute('href', `${setPath}/3`);
	const subsets = row(page, 'Subsets');
	await subsets.getByRole('button', { name: 'Добавить в домашнюю работу', exact: true }).click();
	const first = page.getByRole('dialog', { name: 'Добавить «Subsets» в домашнюю работу' });
	await expect(first.getByLabel('Название', { exact: true })).toHaveValue('Перестановки и сочетания');
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
	expect(await (await page.request.get('/leetcode/api/problems?q=subsets')).json()).toMatchObject({ items: [{ url: 'https://leetcode.com/problems/subsets/', number: 78, title: 'Subsets', difficulty: 'medium', topics: ['Массив', 'Перебор'], summary: 'LeetCode, medium. Шаблон с индексом start. Сохраняйте копию path[:] при каждом вызове, ответов будет 2 в степени n.' }] });
	await page.getByRole('link', { name: 'Домашняя работа', exact: true }).click();
	await expect(page.getByRole('region', { name: 'Будущее', exact: true }).getByRole('link', { name: 'Week 41: backtracking', exact: true })).toHaveCount(2);
	await signIn(page);
	await page.goto(setPath);
	await expect(row(page, 'Перебор: подмножества, перестановки, сочетания')).toContainText('Задач принято 0 из 5');
	await page.getByRole('link', { name: 'Открыть главу', exact: true }).nth(1).click();
	await expect(page).toHaveURL(chapterPath);
	await expect(row(page, 'Subsets').getByRole('link', { name: 'Назначено', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Добавить в домашнюю работу' })).toHaveCount(0);
});

test('shows a task conflict in the dialog', async ({ page, baseURL }) => {
	const headers = { Origin: new URL(baseURL!).origin };
	await signIn(page, 'parent');
	await page.goto(chapterPath);
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
	await page.goto(chapterPath);
	await row(page, 'Subsets').getByRole('button', { name: 'Добавить в домашнюю работу', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Добавить «Subsets» в домашнюю работу' });
	await dialog.getByRole('button', { name: 'Создать и назначить', exact: true }).click();
	await expect(dialog.getByRole('alert')).toHaveText('Верните задачу из архива, прежде чем назначать её.');
	expect(await (await page.request.get('/leetcode/api/homework')).json()).toMatchObject({ items: [] });
});

test('fits the lesson to the width of the page', async ({ page }) => {
	await signIn(page);
	await page.goto(chapterPath);
	const lesson = (await page.locator('article.lesson').boundingBox())!, heading = (await page.locator('main .heading').boundingBox())!;
	expect(lesson.x + lesson.width).toBeCloseTo(heading.x + heading.width, 0);
});

test('steps through a lesson figure', async ({ page }) => {
	await signIn(page);
	await lessonWith(page, [steps, single]);
	await page.goto(chapterPath);
	const figure = page.locator('figure').filter({ hasText: steps.title }), image = figure.getByRole('img');
	const back = figure.getByRole('button', { name: 'Назад', exact: true }), forward = figure.getByRole('button', { name: 'Вперёд', exact: true });
	await expect(image).toHaveAccessibleName(steps.frames[0].caption);
	await expect(figure.getByText('Шаг 1 из 3', { exact: true })).toBeVisible();
	await expect(back).toHaveAttribute('aria-disabled', 'true');
	// Playwright waits for an enabled button, so a click on an aria-disabled button needs force.
	await back.click({ force: true });
	await expect(figure.getByText('Шаг 1 из 3', { exact: true })).toBeVisible();
	await expect(back).toBeFocused();
	await forward.click();
	await expect(image).toHaveAccessibleName(steps.frames[1].caption);
	await expect(figure.locator('p')).toHaveText(steps.frames[1].caption);
	await expect(figure.locator('.figure-mark')).toHaveCount(2);
	await expect(figure.locator('.figure-dim')).toHaveCount(1);
	await expect(back).toHaveAttribute('aria-disabled', 'false');
	await forward.click();
	await forward.click({ force: true });
	await expect(figure.getByText('Шаг 3 из 3', { exact: true })).toBeVisible();
	await expect(image).toHaveAccessibleName(steps.frames[2].caption);
	await expect(forward).toHaveAttribute('aria-disabled', 'true');
	await expect(forward).toBeFocused();
	await back.click();
	await expect(figure.getByText('Шаг 2 из 3', { exact: true })).toBeVisible();
	const one = page.locator('figure').filter({ hasText: single.title });
	await expect(one.getByRole('img')).toHaveAccessibleName(single.frames[0].caption);
	await expect(one.getByRole('button')).toHaveCount(0);
	// A cell has the face color of the theme: #3c3c3c in the dark theme, #c0c0c0 in the light theme.
	const cell = one.locator('rect').first(), fill = () => cell.evaluate(rect => getComputedStyle(rect).fill);
	await expect.poll(fill).toBe('rgb(60, 60, 60)');
	await page.getByRole('button', { name: 'Светлая тема', exact: true }).click();
	await expect.poll(fill).toBe('rgb(192, 192, 192)');
});

test('draws a heap row as a tree in heapq order', async ({ page }) => {
	await signIn(page);
	await lessonWith(page, [heap]);
	await page.goto(chapterPath);
	const figure = page.locator('figure').filter({ hasText: heap.title }), nodes = figure.locator('circle');
	await expect(nodes).toHaveCount(6);
	await expect(figure.locator('.figure-edge')).toHaveCount(5);
	await expect(figure.locator('.figure-index')).toHaveText(['0', '1', '2', '3', '4', '5']);
	// heapq order: place 0 is the root, places 1 and 2 are its children, places 3 and 4 are the children of place 1, place 5 is a child of place 2.
	const at = await nodes.evaluateAll(circles => circles.map(circle => ({ x: Number(circle.getAttribute('cx')), y: Number(circle.getAttribute('cy')), r: Number(circle.getAttribute('r')) })));
	expect(at[0].y).toBeLessThan(at[1].y);
	expect(at[1].y).toBe(at[2].y);
	expect(at[1].y).toBeLessThan(at[3].y);
	const inOrder = [at[3].x, at[1].x, at[4].x, at[0].x, at[5].x, at[2].x];
	expect(inOrder).toEqual([...inOrder].sort((a, b) => a - b));
	// The parent of place i is place (i - 1) >> 1, so the lines join the places (0, 1), (0, 2), (1, 3), (1, 4), (2, 5). A line runs from the border of one circle to the border of the other.
	const lines = await figure.locator('.figure-edge').evaluateAll(items => items.map(item => ['x1', 'y1', 'x2', 'y2'].map(name => Number(item.getAttribute(name)))));
	const border = ([from, to]: number[]) => {
		const length = Math.hypot(at[to].x - at[from].x, at[to].y - at[from].y), ux = (at[to].x - at[from].x) / length, uy = (at[to].y - at[from].y) / length;
		return [at[from].x + ux * at[from].r, at[from].y + uy * at[from].r, at[to].x - ux * at[to].r, at[to].y - uy * at[to].r].map(value => expect.closeTo(value, 3));
	};
	expect(lines).toEqual([[0, 1], [0, 2], [1, 3], [1, 4], [2, 5]].map(border));
	// A marked node has the amber color of the theme: #3a3018 in the dark theme, #fff2c2 in the light theme.
	const fill = () => figure.locator('.figure-mark circle').first().evaluate(circle => getComputedStyle(circle).fill);
	await expect.poll(fill).toBe('rgb(58, 48, 24)');
	const forward = figure.getByRole('button', { name: 'Вперёд', exact: true });
	await forward.click();
	await expect(figure.locator('.figure-dim circle')).toHaveCount(1);
	await expect(figure.locator('.figure-dim').first()).toHaveCSS('opacity', '0.35');
	await forward.click();
	await expect(nodes).toHaveCount(5);
	await expect(figure.locator('.figure-edge')).toHaveCount(4);
	await page.getByRole('button', { name: 'Светлая тема', exact: true }).click();
	await expect.poll(fill).toBe('rgb(255, 242, 194)');
});

test('keeps the nodes of a wide tree apart', async ({ page }) => {
	await signIn(page);
	await lessonWith(page, [wideHeap]);
	await page.goto(chapterPath);
	const nodes = page.locator('figure').filter({ hasText: wideHeap.title }).locator('circle');
	await expect(nodes).toHaveCount(15);
	// A positive gap between each two circles leaves a visible part of each line between a parent and a child.
	const gaps = await nodes.evaluateAll(circles => {
		const all = circles.map(circle => ({ x: Number(circle.getAttribute('cx')), y: Number(circle.getAttribute('cy')), r: Number(circle.getAttribute('r')) }));
		return all.flatMap((a, i) => all.slice(i + 1).map(b => Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r));
	});
	expect(Math.min(...gaps)).toBeGreaterThan(0);
});

test('shows the figures of the new chapter after client navigation', async ({ page }) => {
	await signIn(page);
	await page.goto('/leetcode/sets/two-pointers/1');
	const titles = page.locator('article.lesson figcaption');
	await expect(titles).toHaveText(twoPointers1.figures!.map(figure => figure.title));
	await page.getByRole('link', { name: 'Следующая глава', exact: true }).click();
	await expect(page).toHaveURL('/leetcode/sets/two-pointers/2');
	await expect(titles).toHaveText(twoPointers2.figures!.map(figure => figure.title));
});

test('fits the set pages at the mobile width', async ({ page }, testInfo) => {
	await page.setViewportSize(testInfo.config.projects.find(project => project.name === 'mobile')!.use.viewport!);
	await signIn(page, 'parent');
	await page.goto('/leetcode/sets');
	await expect(page.getByRole('link', { name: 'Перестановки и сочетания', exact: true })).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.goto(setPath);
	await expect(page.getByRole('link', { name: 'Открыть главу', exact: true })).toHaveCount(4);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await lessonWith(page, [wide, wideHeap]);
	await page.goto(chapterPath);
	await expect(page.getByRole('img', { name: wide.frames[0].caption, exact: true })).toBeVisible();
	await expect(page.getByRole('img', { name: wideHeap.frames[0].caption, exact: true })).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await row(page, 'Subsets').getByRole('button', { name: 'Добавить в домашнюю работу', exact: true }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	expect(await page.getByRole('dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth)).toBe(true);
});

test('links a set as material of a problem', async ({ page, notebook }) => {
	await signIn(page, 'parent');
	await page.goto(`/leetcode/problems/${notebook.problem.id}`);
	await page.getByRole('combobox', { name: 'Набор', exact: true }).selectOption({ label: 'Перестановки и сочетания' });
	await page.getByRole('button', { name: 'Привязать', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Отвязать Перестановки и сочетания', exact: true })).toBeVisible();
	await page.getByRole('link', { name: 'Перестановки и сочетания', exact: true }).click();
	await expect(page).toHaveURL(setPath);
});

test('shows the chapter of a task as its material', async ({ page, baseURL }) => {
	const headers = { Origin: new URL(baseURL!).origin };
	await signIn(page, 'parent');
	const homework = await (await page.request.post('/leetcode/api/homework', { headers, data: { title: 'Week 41', instructions: '', dueDate: null } })).json() as Homework;
	const problem = await (await page.request.post('/leetcode/api/problems', { headers, data: { url: 'https://leetcode.com/problems/subsets/', number: 78, title: 'Subsets', difficulty: 'medium', topics: [], summary: '' } })).json() as Problem;
	const task = await (await page.request.post('/leetcode/api/tasks', { headers, data: { homeworkId: homework.id, problemId: problem.id } })).json() as HomeworkTask;
	await page.goto(`/leetcode/tasks/${task.id}`);
	const materials = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Материалы', level: 2 }) });
	await expect(materials.locator('small')).toHaveText('Перестановки и сочетания');
	await expect(materials.getByRole('button', { name: /^Отвязать/ })).toHaveCount(0);
	await materials.getByRole('link', { name: 'Глава 2. Перебор: подмножества, перестановки, сочетания', exact: true }).click();
	await expect(page).toHaveURL(chapterPath);
});

// A selection of the sample takes only the code: the button and the output are not copied.
// The output is an empty live region before the first run, so a screen reader reads the first result.
const samples = [
	{ name: 'prints the output of a lesson sample', code: 'print(2 + 3)', output: '5' },
	{ name: 'shows the line and the message of a sample error', code: 'x', output: "Строка 1: NameError: name 'x' is not defined" },
	{ name: 'shows the output of a sample before its error', code: 'print(1)\nprint(nums2)', output: "1\nСтрока 2: NameError: name 'nums2' is not defined" },
	{ name: 'gives a sample no input', code: 'n = int(input())', output: 'Строка 1: EOFError: EOF when reading a line' },
	{ name: 'tells that a sample printed nothing', code: 'y = 1', output: 'Программа ничего не напечатала.' },
	{ name: 'stops a sample without end after 2 seconds', code: 'while True:\n    pass', output: 'Превышено время (2 с)' },
];
for (const row of samples) {
	test(row.name, async ({ page }) => {
		test.slow();
		await signIn(page);
		await lessonCode(page, [`<pre><code class="language-python">${row.code}</code></pre>`]);
		await page.goto(chapterPath);
		const sample = page.locator('article.lesson pre'), output = sample.getByRole('status');
		await expect(output).toHaveText('');
		await sample.getByRole('button', { name: 'Запустить', exact: true }).click();
		await expect(sample.getByRole('button', { name: 'Запускаем…', exact: true })).toBeDisabled();
		await expect(output).toHaveText(row.output, { timeout: 30_000 });
		await expect(sample.getByRole('button', { name: 'Запустить', exact: true })).toBeEnabled();
		expect(await sample.evaluate(pre => { getSelection()!.selectAllChildren(pre); return getSelection()!.toString(); })).toBe(row.code);
	});
}

test('shows a failed Python load under a sample', async ({ page }) => {
	await signIn(page);
	await lessonCode(page, ['<pre><code class="language-python">print(1)</code></pre>']);
	await page.route('**/leetcode/assets/python.worker.js', route => route.fulfill({ status: 404 }));
	await page.goto(chapterPath);
	const sample = page.locator('article.lesson pre');
	await sample.getByRole('button', { name: 'Запустить', exact: true }).click();
	await expect(sample.getByRole('status')).toHaveText('Не удалось запустить Python. Обновите страницу и попробуйте снова.');
	await expect(sample.getByRole('button', { name: 'Запустить', exact: true })).toBeEnabled();
});

test('shows the run button only on a Python sample that runs', async ({ page }) => {
	await signIn(page);
	await lessonCode(page, ['<pre><code class="language-python">print(1)</code></pre>', '<pre class="no-run"><code class="language-python">print(2)</code></pre>', '<pre><code class="language-plaintext">3</code></pre>']);
	await page.goto(chapterPath);
	const blocks = page.locator('article.lesson pre');
	await expect(blocks).toHaveCount(3);
	await expect(blocks.nth(0).getByRole('button', { name: 'Запустить', exact: true })).toBeVisible();
	await expect(blocks.nth(1).getByRole('button')).toHaveCount(0);
	await expect(blocks.nth(2).getByRole('button')).toHaveCount(0);
});

test('runs a lesson sample in the work window', async ({ page, baseURL }) => {
	test.slow();
	const headers = { Origin: new URL(baseURL!).origin };
	await signIn(page);
	await lessonCode(page, ['<pre><code class="language-python">print(2 + 3)</code></pre>']);
	const problem = await (await page.request.post('/leetcode/api/problems', { headers, data: { url: 'https://leetcode.com/problems/subsets/', number: 78, title: 'Subsets', difficulty: 'medium', topics: [], summary: '' } })).json() as Problem;
	await page.goto(`/leetcode/problems/${problem.id}`);
	const sample = page.locator('article.lesson pre');
	await sample.getByRole('button', { name: 'Запустить', exact: true }).click();
	await expect(sample.locator('output')).toHaveText('5', { timeout: 30_000 });
});
