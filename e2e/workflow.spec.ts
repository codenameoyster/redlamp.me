import { test, expect, signIn, addMessages, type TestEnv } from './fixtures';
import type { TaskDetails } from '../shared/leetcode';

test('completes learning with two accounts and a linked set', async ({ page: parent, browser, baseURL }, testInfo) => {
	const studentContext = await browser.newContext({ baseURL, viewport: testInfo.project.use.viewport });
	const student = await studentContext.newPage();
	try {
		await signIn(parent, 'parent');
		await parent.getByRole('link', { name: 'Задачи', exact: true }).click();
		await parent.getByRole('button', { name: 'Добавить задачу', exact: true }).click();
		await parent.getByLabel('Ссылка на задачу').fill('https://leetcode.com/problems/minimum-window-substring/');
		await parent.getByLabel('Название', { exact: true }).fill('Minimum Window Substring');
		await parent.getByRole('dialog').getByRole('combobox', { name: 'Сложность' }).selectOption('hard');
		await parent.getByLabel('Темы', { exact: true }).fill('Sliding window, Hash map');
		await parent.getByRole('button', { name: 'Сохранить задачу', exact: true }).click();
		await expect(parent.getByRole('heading', { name: 'Minimum Window Substring', exact: true })).toBeVisible();
		const problemId = parent.url().split('/').at(-1)!;
		await parent.getByRole('link', { name: 'Домашняя работа', exact: true }).click();
		await parent.getByLabel('Название', { exact: true }).fill('Week 41: sliding window');
		await parent.getByLabel('Задание', { exact: true }).fill('Explain when the window can shrink.');
		await parent.getByRole('button', { name: 'Создать домашнюю работу', exact: true }).click();
		await expect(parent.getByRole('heading', { name: 'Week 41: sliding window', level: 1 })).toBeVisible();
		await parent.getByRole('group', { name: 'Задача', exact: true }).getByRole('radio', { name: /^Minimum Window Substring/ }).check();
		await parent.getByRole('button', { name: 'Добавить задание', exact: true }).click();
		await expect(parent.getByText('Назначено', { exact: true })).toBeVisible();
		await parent.getByRole('combobox', { name: 'Набор', exact: true }).selectOption({ label: 'Перестановки и сочетания' });
		await parent.getByRole('button', { name: 'Привязать' }).click();
		await expect(parent.getByRole('link', { name: 'Перестановки и сочетания', exact: true })).toBeVisible();
		await parent.getByRole('link', { name: 'Minimum Window Substring', exact: true }).click();
		await expect(parent.getByRole('heading', { name: 'Minimum Window Substring', level: 1 })).toBeVisible();
		const taskURL = parent.url(), taskId = taskURL.split('/').at(-1)!;
		await signIn(student);
		await student.goto(taskURL);
		await student.getByRole('link', { name: 'Перестановки и сочетания', exact: true }).click();
		await expect(student.getByRole('heading', { name: 'Перестановки и сочетания', level: 1 })).toBeVisible();
		await student.goBack();
		await student.getByLabel('Основная идея', { exact: true }).fill('Shrink only while all target counts are satisfied.');
		await student.getByLabel('Код решения', { exact: true }).fill(`return sliding_window(source, target) # ${'long_code_line_'.repeat(40)}`);
		expect(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		await student.screenshot({ path: testInfo.outputPath('notebook.png'), fullPage: true });
		await student.getByRole('button', { name: 'Решено', exact: true }).click();
		await expect(student.getByText('Отправлено', { exact: true })).toBeVisible();
		await parent.reload();
		await expect(parent.getByText('Отправлено', { exact: true })).toBeVisible();
		const firstDetails = await (await parent.request.get(`/leetcode/api/tasks/${taskId}`)).json() as TaskDetails;
		const firstAttemptId = firstDetails.submissions[0].attemptId;
		await parent.getByLabel('Отзыв', { exact: true }).fill('Explain why shrinking cannot miss a shorter valid window.');
		await parent.getByRole('button', { name: 'Вернуть на доработку' }).click();
		await expect(parent.getByText('Нужны правки: Explain why shrinking cannot miss a shorter valid window.', { exact: true })).toBeVisible();
		await parent.getByRole('link', { name: 'Week 41: sliding window', exact: true }).click();
		const tasks = parent.getByRole('region', { name: 'Задания' }), title = (await tasks.getByRole('link', { name: 'Minimum Window Substring', exact: true }).boundingBox())!, difficulty = (await tasks.getByText('Сложно', { exact: true }).boundingBox())!;
		expect(title.x + title.width <= difficulty.x || title.y + title.height <= difficulty.y).toBe(true);
		await parent.goto(taskURL);
		await student.reload();
		await expect(student.getByText('Нужны правки: Explain why shrinking cannot miss a shorter valid window.', { exact: true })).toBeVisible();
		await student.getByLabel('Почему это работает', { exact: true }).fill('Each valid left boundary is checked before it is removed.');
		await student.getByLabel('Код решения', { exact: true }).fill('return revised_sliding_window(source, target)');
		await student.getByRole('button', { name: 'Решено', exact: true }).click();
		await expect(student.getByText('Отправлено', { exact: true })).toBeVisible();
		await parent.reload();
		await expect(parent.getByLabel('Код решения', { exact: true })).toHaveText('return revised_sliding_window(source, target)');
		await parent.getByRole('button', { name: 'Завершить' }).click();
		await expect(parent.getByText('Завершено', { exact: true }).first()).toBeVisible();
		const original = await (await parent.request.get(`/leetcode/api/problems/${problemId}/attempts/${firstAttemptId}`)).json();
		expect(original.document.approaches[0].code).toBe(`return sliding_window(source, target) # ${'long_code_line_'.repeat(40)}`);
		expect(await (await parent.request.get(`/leetcode/api/problems/${problemId}`)).json()).toMatchObject({ solved: true, understanding: 'independent' });
		await parent.getByRole('link', { name: 'Сегодня', exact: true }).click();
		await expect(parent.getByRole('heading', { name: 'Понимание тем' })).toBeVisible();
		await parent.screenshot({ path: testInfo.outputPath('today.png'), fullPage: true });
	} finally { await studentContext.close(); }
});

const emptyStates = [
	{ name: 'empty notebook shows the first-problem prompt', path: '/leetcode', text: 'Ваша первая задача начинается здесь.' },
	{ name: 'empty library shows the empty library message', path: '/leetcode/problems', text: 'Ничего не найдено. Добавьте задачу или измените фильтры.' },
];
for (const row of emptyStates) {
	test(row.name, async ({ page }) => {
		await signIn(page, 'parent');
		await page.goto(row.path);
		await expect(page.getByText(row.text, { exact: true })).toBeVisible();
	});
}

test('switches the appearance from the top bar and keeps it after a reload', async ({ page }) => {
	await signIn(page, 'parent');
	const bar = page.getByRole('banner');
	await expect(bar.getByText('parent-test', { exact: true })).toBeVisible();
	await expect(bar.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
	await bar.getByRole('button', { name: 'Светлая тема', exact: true }).click();
	await expect(bar.getByRole('button', { name: 'Тёмная тема', exact: true })).toBeVisible();
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-appearance', 'light');
});

test('opens and closes the problem dialog with the keyboard', async ({ page }) => {
	await signIn(page, 'parent');
	await page.goto('/leetcode/problems');
	await page.getByRole('button', { name: 'Добавить задачу', exact: true }).focus();
	await page.keyboard.press('Enter');
	await expect(page.getByLabel('Ссылка на задачу')).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('button', { name: 'Добавить задачу', exact: true })).toBeFocused();
});

test('shows the tutor panel full screen on a phone', async ({ page, notebook, server }, testInfo) => {
	test.skip(testInfo.project.name !== 'mobile', 'Only the mobile project has a phone viewport.');
	const { DB } = await server.getWorker<TestEnv>().getEnv(), cells = Array.from({ length: 24 }, (_, i) => `cell_${i}`);
	await addMessages(DB, 'problem', notebook.problem.id, [{ author: 'student', body: 'Show the array.' }, { author: 'assistant', body: `\`\`\`diagram\n${JSON.stringify({ type: 'array', cells })}\n\`\`\`\n\n\`\`\`python\nreturn ${'long_code_line_'.repeat(20)}\n\`\`\`` }]);
	await page.getByRole('button', { name: 'Спросить ИИ', exact: true }).click();
	const panel = page.getByRole('dialog', { name: 'ИИ-репетитор' });
	await expect(panel.getByRole('img', { name: /^Массив/ })).toBeVisible();
	expect(await panel.boundingBox()).toEqual({ x: 0, y: 0, width: 390, height: 844 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	expect(await panel.getByRole('list', { name: 'Сообщения' }).evaluate(list => list.scrollWidth <= list.clientWidth)).toBe(true);
	// iOS zooms the page when a field with a font under 16px gets focus. The code field keeps the 12.5px size of the code.
	await expect(panel.getByLabel('Сообщение', { exact: true })).toBeFocused();
	expect(await panel.getByLabel('Сообщение', { exact: true }).evaluate(field => getComputedStyle(field).fontSize)).toBe('16px');
	expect(await page.getByLabel('Код решения', { exact: true }).evaluate(field => getComputedStyle(field).fontSize)).toBe('12.5px');
});

test('explains a lesson selection with a touch tap', async ({ browser, baseURL }, testInfo) => {
	test.skip(testInfo.project.name !== 'mobile', 'Only the mobile project has a phone viewport.');
	const context = await browser.newContext({ baseURL, viewport: testInfo.project.use.viewport, hasTouch: true });
	const page = await context.newPage();
	try {
		let body: unknown;
		await signIn(page);
		await page.route(url => url.pathname === '/leetcode/api/tutor/messages', route => {
			if (route.request().method() !== 'POST') return route.fallback();
			body = route.request().postDataJSON();
			return route.fulfill({ contentType: 'text/event-stream', body: 'data: {"done":true}\n\n' });
		});
		await page.goto('/leetcode/sets/permutations-and-combinations/2');
		await page.locator('article.lesson').locator('p', { hasText: 'которая вызывает сама себя' }).selectText();
		await page.getByRole('button', { name: 'Объяснить с ИИ', exact: true }).tap();
		await expect(page.getByRole('dialog', { name: 'ИИ-репетитор' })).toBeVisible();
		await expect.poll(() => body).toEqual({ kind: 'set', id: 'permutations-and-combinations', message: 'Объясните эту часть.', quote: 'Рекурсия это функция, которая вызывает сама себя. Для дерева это удобно. Функция делает один шаг вниз, а дальше просит саму себя сделать остальное. Функцию, которая идёт по дереву, назовём dfs.' });
	} finally { await context.close(); }
});

test('hides the tip after a touch tap', async ({ browser, baseURL }, testInfo) => {
	test.skip(testInfo.project.name !== 'mobile', 'Only the mobile project has a phone viewport.');
	const context = await browser.newContext({ baseURL, viewport: testInfo.project.use.viewport, hasTouch: true, isMobile: true });
	const page = await context.newPage();
	try {
		await signIn(page);
		const bar = page.getByRole('banner');
		// A phone keeps the hover on the button after a tap. A click gives this hover, and tap() does not. The tip shows 0.3 s after the hover starts.
		await bar.getByRole('button', { name: 'Светлая тема', exact: true }).click();
		await page.waitForTimeout(600);
		expect(await bar.getByRole('button', { name: 'Тёмная тема', exact: true }).evaluate(button => getComputedStyle(button, '::after').visibility)).toBe('hidden');
	} finally { await context.close(); }
});

test('shows the tip of a hard word after a touch tap', async ({ browser, baseURL }, testInfo) => {
	test.skip(testInfo.project.name !== 'mobile', 'Only the mobile project has a phone viewport.');
	const context = await browser.newContext({ baseURL, viewport: testInfo.project.use.viewport, hasTouch: true, isMobile: true });
	const page = await context.newPage();
	try {
		await signIn(page);
		await page.goto('/leetcode/sets/two-pointers/1');
		const term = page.locator('article.lesson .term').first(), tip = () => term.evaluate(element => getComputedStyle(element, '::after').visibility);
		await term.tap();
		await expect.poll(tip).toBe('visible');
		await page.getByRole('heading', { level: 1 }).tap();
		await expect.poll(tip).toBe('hidden');
	} finally { await context.close(); }
});
