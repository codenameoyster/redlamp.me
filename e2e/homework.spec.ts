import { test, expect, signIn, addTask, type TestEnv } from './fixtures';
import type { Homework, Problem } from '../shared/leetcode';
import { addCalendarDays, localDate } from '../shared/dates';

test('opens, submits, returns, and completes a task in one window', async ({ page, notebook }) => {
	test.slow();
	await signIn(page, 'parent');
	await page.getByRole('link', { name: 'Домашняя работа', exact: true }).click();
	await page.getByLabel('Название', { exact: true }).fill('Week 41: hash maps');
	await page.getByLabel('Задание', { exact: true }).fill('Explain the invariant.');
	await page.getByRole('button', { name: 'Создать домашнюю работу', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Week 41: hash maps', level: 1 })).toBeVisible();
	await page.getByRole('button', { name: 'Изменить домашнюю работу', exact: true }).click();
	await page.getByLabel('Срок', { exact: true }).fill('2026-10-20');
	await page.getByRole('button', { name: 'Сохранить домашнюю работу', exact: true }).click();
	await expect(page.getByText('Срок: 2026-10-20', { exact: true })).toBeVisible();
	await page.getByRole('group', { name: 'Задача', exact: true }).getByRole('radio', { name: new RegExp(`^${notebook.problem.title}`) }).check();
	await page.getByRole('button', { name: 'Добавить задание', exact: true }).click();
	await expect(page.getByText('Назначено', { exact: true })).toBeVisible();
	await page.getByRole('link', { name: notebook.problem.title, exact: true }).click();
	await expect(page.getByText('Explain the invariant.', { exact: true })).toBeVisible();
	const taskURL = page.url(), taskPath = new URL(taskURL).pathname;
	await signIn(page);
	await page.goto(`/leetcode/problems/${notebook.problem.id}`);
	await expect(page.getByRole('link', { name: 'Week 41: hash maps', exact: true })).toHaveAttribute('href', taskPath);
	await expect(page.getByRole('link', { name: 'LeetCode ↗', exact: true })).toHaveAttribute('href', notebook.problem.url);
	await page.route('**/leetcode/api/problems/*/tests', route => route.fulfill({ json: { spec: { mode: 'call', method: 'twoSum' }, source: 'leetcode', standard: [{ input: '[[2, 7, 11, 15], 9]', expected: '[0, 1]' }], own: [] } }));
	await page.goto(taskURL);
	await expect(page.getByText('В работе', { exact: true })).toBeVisible();
	const code = page.getByLabel('Код решения', { exact: true });
	await code.fill('class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        return [0, 1]\n');
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
	await page.getByRole('button', { name: 'Запустить тесты', exact: true }).click();
	await expect(page.getByText(/^Пройдено/)).toHaveText('Пройдено 1 из 1', { timeout: 30_000 });
	await page.getByRole('button', { name: 'Решено', exact: true }).click();
	await expect(page.getByText('Отправлено', { exact: true })).toBeVisible();
	await expect(code).toHaveAttribute('readonly', '');
	await expect(page.getByRole('button', { name: 'Решено', exact: true })).toHaveCount(0);
	await signIn(page, 'parent');
	await page.goto(taskURL);
	await expect(page.getByLabel('Код решения', { exact: true })).toHaveValue(/return \[0, 1\]/);
	await expect(page.getByText('Тесты пройдены', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Запустить тесты', exact: true })).toHaveCount(0);
	await page.getByLabel('Отзыв', { exact: true }).fill('Add a correctness argument.');
	await page.getByRole('button', { name: 'Вернуть на доработку' }).click();
	await expect(page.getByText('Нужны правки: Add a correctness argument.', { exact: true })).toBeVisible();
	await signIn(page);
	await page.goto(taskURL);
	await expect(page.getByText('Нужны правки: Add a correctness argument.', { exact: true })).toBeVisible();
	await expect(code).toHaveValue(/return \[0, 1\]/);
	await expect(code).toBeEditable();
	await page.getByLabel('Почему это работает', { exact: true }).fill('Every earlier value is in the frequency map.');
	await page.getByRole('button', { name: 'Решено', exact: true }).click();
	await expect(page.getByText('Отправлено', { exact: true })).toBeVisible();
	await signIn(page, 'parent');
	await page.goto(taskURL);
	await expect(page.getByLabel('Почему это работает', { exact: true })).toHaveValue('Every earlier value is in the frequency map.');
	await page.getByRole('button', { name: 'Завершить' }).click();
	await expect(page.getByText('Завершено', { exact: true }).first()).toBeVisible();
	await page.getByRole('link', { name: 'Week 41: hash maps', exact: true }).click();
	await expect(page.getByText('Завершено', { exact: true })).toBeVisible();
	await page.getByRole('link', { name: 'Домашняя работа', exact: true }).click();
	await expect(page.getByRole('region', { name: 'Принятое', exact: true }).getByRole('link', { name: notebook.problem.title, exact: true })).toHaveAttribute('href', taskPath);
});

test('shows the tasks in three sections and spreads the accepted tasks over 30 days', async ({ page, notebook, server }) => {
	const { DB } = await server.getWorker<TestEnv>().getEnv(), [started, waiting, dropped] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
	const insert = DB.prepare("INSERT INTO problems (id,slug,title,difficulty,topics,summary,search_text,created_at,updated_at) VALUES (?,?,?,'easy','[]','','','now','now')");
	await DB.batch([insert.bind(started, 'started', 'Started'), insert.bind(waiting, 'waiting', 'Waiting'), insert.bind(dropped, 'dropped', 'Dropped')]);
	for (const [id, state] of [[notebook.problem.id, 'completed'], [started, 'in_progress'], [waiting, 'assigned'], [dropped, 'cancelled']]) await addTask(DB, id, state);
	await page.getByRole('link', { name: 'Домашняя работа', exact: true }).click();
	const section = (name: string) => page.getByRole('region', { name, exact: true }), accepted = section('Принятое');
	await expect(section('В процессе').getByRole('heading', { level: 3 })).toHaveText(['Started']);
	await expect(section('Будущее').getByRole('heading', { level: 3 })).toHaveText(['Waiting']);
	await expect(accepted.getByRole('heading', { level: 3 })).toHaveText([notebook.problem.title]);
	await expect(accepted.getByRole('link', { name: 'Week 41', exact: true })).toHaveAttribute('href', /^\/leetcode\/homework\/[a-f0-9-]{36}$/);
	await expect(page.getByText('Dropped', { exact: true })).toHaveCount(0);
	const spread = accepted.getByRole('button', { name: 'Распределить повторения на 30 дней', exact: true });
	await spread.click();
	await expect(accepted.getByRole('status')).toHaveText(/^1 задача распределена с (\d\d\.\d\d) по \1\.$/);
	await spread.click();
	await expect(accepted.getByRole('status')).toHaveText('Все принятые задачи уже распределены.');
	await DB.prepare('UPDATE problems SET next_review_date=? WHERE id=?').bind(localDate(), notebook.problem.id).run();
	await page.getByRole('link', { name: 'Сегодня', exact: true }).click();
	await expect(page.getByRole('heading', { level: 3, name: notebook.problem.title }).getByRole('link')).toHaveAttribute('href', `/leetcode/problems/${notebook.problem.id}/review?pick=1`);
});

test('moves the due date by one day once with Сила Бомжа', async ({ page, notebook, server }) => {
	const { DB } = await server.getWorker<TestEnv>().getEnv(), next = addCalendarDays(localDate(), 1), { homeworkId } = await addTask(DB, notebook.problem.id, 'assigned', localDate());
	await page.goto(`/leetcode/homework/${homeworkId}`);
	const power = page.getByRole('button', { name: 'Сила Бомжа', exact: true });
	await power.click();
	await expect(page.getByText(`Срок: ${next}`, { exact: true })).toBeVisible();
	await expect(page.getByText(`Сила Бомжа: срок перенесён на ${next.slice(8)}.${next.slice(5, 7)}.`, { exact: true })).toBeVisible();
	await expect(power).toHaveCount(0);
});

test('cancels the task from the work window', async ({ page, notebook, server }) => {
	const { DB } = await server.getWorker<TestEnv>().getEnv(), { taskId } = await addTask(DB, notebook.problem.id);
	await signIn(page, 'parent');
	await page.goto(`/leetcode/tasks/${taskId}`);
	await expect(page.getByText('Назначено', { exact: true })).toBeVisible();
	page.once('dialog', dialog => dialog.accept());
	await page.getByRole('button', { name: 'Отменить задание', exact: true }).click();
	await expect(page.getByText('Отменено', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Отменить задание', exact: true })).toHaveCount(0);
});

test('assigns the selected problem after the problem search refreshes', async ({ page, notebook, baseURL }) => {
	const headers = { Origin: new URL(baseURL!).origin };
	const created = await page.request.post('/leetcode/api/problems', { headers, data: { url: 'https://leetcode.com/problems/3sum/', number: 15, title: '3Sum', difficulty: 'medium', topics: ['Arrays'], summary: 'Find triplets with a zero sum.' } });
	expect(created.status()).toBe(201);
	await signIn(page, 'parent');
	const homework = await (await page.request.post('/leetcode/api/homework', { headers, data: { title: 'Week 41', instructions: '', dueDate: null } })).json() as Homework;
	await page.goto(`/leetcode/homework/${homework.id}`);
	const problem = page.getByRole('group', { name: 'Задача', exact: true }), chosen = problem.getByRole('radio', { name: new RegExp(`^${notebook.problem.title}`) });
	await chosen.check();
	let release!: () => void;
	const held = new Promise<void>(resolve => { release = resolve; });
	await page.route(url => url.pathname === '/leetcode/api/problems' && url.searchParams.get('q') === 'Sum', async route => { await held; await route.continue(); });
	const search = page.waitForRequest(request => new URL(request.url()).searchParams.get('q') === 'Sum');
	await page.getByRole('searchbox', { name: 'Найти задачу', exact: true }).fill('Sum');
	await search;
	await expect(chosen).toBeChecked();
	release();
	await expect(problem.locator('label')).toHaveText([/^3Sum/, new RegExp(`^${notebook.problem.title}`)]);
	await expect(chosen).toBeChecked();
	await page.getByRole('searchbox', { name: 'Найти задачу', exact: true }).fill('3Sum');
	await expect(problem.locator('label')).toHaveText([new RegExp(`^${notebook.problem.title}`), /^3Sum/]);
	await expect(chosen).toBeChecked();
	await page.getByRole('button', { name: 'Добавить задание', exact: true }).click();
	await expect(page.getByRole('region', { name: 'Задания' }).getByRole('link', { name: notebook.problem.title, exact: true })).toBeVisible();
});

test('shows the topics and the colored level at the right side of each problem in Add a task', async ({ page, notebook, baseURL }) => {
	await signIn(page, 'parent');
	const homework = await (await page.request.post('/leetcode/api/homework', { headers: { Origin: new URL(baseURL!).origin }, data: { title: 'Week 41', instructions: '', dueDate: null } })).json() as Homework;
	await page.goto(`/leetcode/homework/${homework.id}`);
	const row = page.getByRole('group', { name: 'Задача', exact: true }).locator('label').filter({ hasText: notebook.problem.title });
	await expect(row.getByText('Arrays', { exact: true })).toBeVisible();
	const level = row.getByText('Легко', { exact: true });
	await expect(level).toHaveClass('tag easy');
	const [rowBox, levelBox] = [await row.boundingBox(), await level.boundingBox()];
	expect(rowBox!.x + rowBox!.width - levelBox!.x - levelBox!.width).toBeLessThan(32);
});

test('shows a new review until the student opens the task', async ({ page, notebook, server }) => {
	const { DB } = await server.getWorker<TestEnv>().getEnv(), { taskId } = await addTask(DB, notebook.problem.id, 'changes_requested');
	await DB.prepare("INSERT INTO feedback (id,problem_id,task_id,author,kind,body,created_at) VALUES (?,?,?,'parent','changes_requested','Explain the invariant.',?)").bind(crypto.randomUUID(), notebook.problem.id, taskId, new Date().toISOString()).run();
	await page.getByRole('link', { name: 'Домашняя работа', exact: true }).click();
	const dot = page.getByRole('img', { name: 'Новое сообщение', exact: true });
	await expect(page.getByRole('article').filter({ hasText: 'Week 41' }).getByRole('img', { name: 'Новое сообщение', exact: true })).toBeVisible();
	await page.getByRole('link', { name: 'Week 41', exact: true }).click();
	await expect(page.getByRole('region', { name: 'Задания' }).getByRole('img', { name: 'Новое сообщение', exact: true })).toBeVisible();
	await page.getByRole('link', { name: notebook.problem.title, exact: true }).click();
	await expect(page.getByText('Нужны правки: Explain the invariant.', { exact: true })).toBeVisible();
	await page.getByRole('link', { name: 'Домашняя работа', exact: true }).click();
	await expect(page.getByRole('link', { name: 'Week 41', exact: true })).toBeVisible();
	await expect(dot).toHaveCount(0);
});

const panes = [
	{ name: 'shows the chapter beside the code and the notes below', url: 'https://leetcode.com/problems/subsets/', title: 'Subsets', chapter: true },
	{ name: 'shows the notes beside the code without a chapter', url: 'https://leetcode.com/problems/two-sum/', title: 'Two Sum', chapter: false },
];
for (const row of panes) {
	test(row.name, async ({ page, baseURL, server }) => {
		await signIn(page);
		const problem = await (await page.request.post('/leetcode/api/problems', { headers: { Origin: new URL(baseURL!).origin }, data: { url: row.url, number: null, title: row.title, difficulty: 'medium', topics: [], summary: '' } })).json() as Problem;
		await page.route('**/leetcode/api/problems/*/tests', route => route.fulfill({ json: { spec: null, source: 'none', standard: [], own: [] } }));
		const { DB } = await server.getWorker<TestEnv>().getEnv(), { taskId } = await addTask(DB, problem.id);
		await page.goto(`/leetcode/tasks/${taskId}`);
		const code = page.getByLabel('Код решения', { exact: true }), idea = page.getByLabel('Основная идея', { exact: true });
		await expect(code).toBeEditable();
		await expect(page.getByRole('link', { name: 'Глава 2. Перебор: подмножества, перестановки, сочетания', exact: true })).toHaveCount(row.chapter ? 2 : 0);
		const [codeBox, ideaBox] = [(await code.boundingBox())!, (await idea.boundingBox())!];
		expect(row.chapter ? ideaBox.y > codeBox.y + codeBox.height : ideaBox.x + ideaBox.width < codeBox.x).toBe(true);
	});
}

const statements = [
	{ name: 'shows the statement of a set task', url: 'https://leetcode.com/problems/subsets/', text: null, shown: 'Пример 1', hidden: 'Saved hint.' },
	{ name: 'shows the LeetCode text of a problem outside the sets', url: 'https://leetcode.com/problems/two-sum/', text: 'Return the indices of the two numbers.', shown: 'Return the indices of the two numbers.', hidden: 'Saved hint.' },
	{ name: 'shows the summary of a Codeforces problem outside the sets', url: 'https://codeforces.com/problemset/problem/1/A', text: null, shown: 'Saved hint.', hidden: 'Пример 1' },
];
for (const row of statements) {
	test(row.name, async ({ page, baseURL }) => {
		await signIn(page);
		const problem = await (await page.request.post('/leetcode/api/problems', { headers: { Origin: new URL(baseURL!).origin }, data: { url: row.url, number: null, title: 'Task', difficulty: 'medium', topics: [], summary: 'Saved hint.' } })).json() as Problem;
		await page.route('**/leetcode/api/problems/*/tests', route => route.fulfill({ json: { spec: null, source: 'none', standard: [], own: [] } }));
		if (row.text) await page.route('**/leetcode/api/problems/*/statement', route => route.fulfill({ json: { html: null, text: row.text } }));
		await page.goto(`/leetcode/problems/${problem.id}`);
		await expect(page.getByText(row.shown, { exact: true })).toBeVisible();
		await expect(page.getByText(row.hidden, { exact: true })).toHaveCount(0);
	});
}

test('moves the pane divider with the keyboard and the pointer and keeps the place', async ({ page, notebook }) => {
	const divider = page.getByRole('separator', { name: 'Граница панелей' });
	await expect(divider).toHaveAttribute('aria-orientation', 'vertical');
	await expect(divider).toHaveAttribute('aria-valuenow', '50');
	await divider.focus();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await expect(divider).toHaveAttribute('aria-valuenow', '60');
	for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowLeft');
	await expect(divider).toHaveAttribute('aria-valuenow', '25');
	const panes = (await divider.locator('..').boundingBox())!, box = (await divider.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + 20);
	await page.mouse.down();
	// The middle of the divider is 9px right of the left pane: the 6px gap and half of the 6px divider.
	await page.mouse.move(panes.x + panes.width * 0.7 + 9, box.y + 20, { steps: 5 });
	await page.mouse.up();
	await expect(divider).toHaveAttribute('aria-valuenow', '70');
	await page.goto(`/leetcode/problems/${notebook.problem.id}`);
	await expect(divider).toHaveAttribute('aria-valuenow', '70');
	await page.setViewportSize({ width: 800, height: 1000 });
	await expect(divider).toBeHidden();
	const [code, notes] = [(await page.getByLabel('Код решения', { exact: true }).boundingBox())!, (await page.getByLabel('Основная идея', { exact: true }).boundingBox())!];
	expect(code.y).toBeGreaterThan(notes.y);
});
