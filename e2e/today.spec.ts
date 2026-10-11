import { test, expect, addTask, signIn, type TestEnv } from './fixtures';

const dueDates = [
	{ name: 'submitted homework past its due date is not overdue', state: 'submitted', due: 'Срок 2020-01-01' },
	{ name: 'assigned homework past its due date is overdue', state: 'assigned', due: 'Срок 2020-01-01 - Просрочено' },
];
for (const row of dueDates) {
	test(row.name, async ({ page, server, notebook }) => {
		const { DB } = await server.getWorker<TestEnv>().getEnv();
		const { taskId } = await addTask(DB, notebook.problem.id, row.state, '2020-01-01');
		await page.goto('/leetcode');
		await expect(page.getByText(row.due, { exact: true })).toBeVisible();
		await expect(page.locator(`a[href="/leetcode/tasks/${taskId}"]`)).toHaveText(notebook.problem.title);
		await expect(page.getByText('Week 41', { exact: true })).toBeVisible();
	});
}

const nextSteps = [
	{ name: 'student with only completed homework sees the problem library', homework: 'completed' },
	{ name: 'student with only submitted homework sees the problem library', homework: 'submitted' },
];
for (const row of nextSteps) {
	test(row.name, async ({ page, server, notebook }) => {
		const { DB } = await server.getWorker<TestEnv>().getEnv();
		await DB.prepare("UPDATE attempts SET state='saved',saved_at='now' WHERE id=?").bind(notebook.attempt.id).run();
		await addTask(DB, notebook.problem.id, row.homework, '2020-01-01');
		await page.goto('/leetcode');
		await expect(page.getByRole('heading', { name: 'Выберите следующую задачу.' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Открыть библиотеку задач' })).toHaveAttribute('href', '/leetcode/problems');
		await expect(page.getByRole('heading', { name: 'Ваша первая задача начинается здесь.' })).toHaveCount(0);
	});
}

test('student sees the level and the earned badge after an accepted attempt', async ({ page, server, notebook }) => {
	const { DB } = await server.getWorker<TestEnv>().getEnv();
	await DB.prepare("UPDATE attempts SET state='saved',saved_at='now',acceptance='accepted',understanding='with_help' WHERE id=?").bind(notebook.attempt.id).run();
	await page.goto('/leetcode');
	await expect(page.getByRole('heading', { name: 'Уровень 1', exact: true })).toBeVisible();
	const bar = page.getByRole('main').getByRole('progressbar', { name: 'Прогресс до уровня 2', exact: true });
	await expect(bar).toHaveAttribute('value', '10');
	await expect(bar).toHaveAttribute('max', '100');
	const badges = page.getByRole('list', { name: 'Значки' });
	await expect(badges.getByRole('listitem')).toHaveCount(6);
	await expect(badges.getByRole('listitem').filter({ hasText: 'Первая принятая' })).toBeVisible();
	await expect(badges.getByRole('listitem').filter({ hasText: 'Первая принятая' }).getByRole('img', { name: 'Не получен' })).toHaveCount(0);
	await expect(badges.getByRole('img', { name: 'Не получен' })).toHaveCount(5);
	const chip = page.getByRole('banner').getByRole('progressbar', { name: 'Прогресс до уровня 2', exact: true });
	await expect(chip).toHaveAttribute('value', '10');
	await page.setViewportSize({ width: 1024, height: 1000 });
	expect((await chip.boundingBox())!.width).toBe(96);
});

const picks = [
	{ name: 'pick hides the saved work and starts a new attempt', draft: false, code: '' },
	{ name: 'pick with a draft opens the draft', draft: true, code: 'return draft_solution' },
];
for (const row of picks) {
	test(row.name, async ({ page, server }) => {
		const { DB } = await server.getWorker<TestEnv>().getEnv();
		const work = (code: string) => JSON.stringify({ notes: '', approaches: [{ id: crypto.randomUUID(), label: '', idea: '', correctness: '', timeComplexity: '', spaceComplexity: '', edgeCases: '', mistakes: '', language: 'python', code }] });
		const attempt = DB.prepare("INSERT INTO attempts (id,problem_id,state,document,search_text,acceptance,understanding,saved_at,created_at,updated_at) VALUES (?,?,?,?,'','accepted','with_help',?,'now','now')");
		await DB.batch(['two-sum-ii-input-array-is-sorted', 'max-number-of-k-sum-pairs', 'container-with-most-water', 'sum-of-all-subset-xor-totals', 'letter-case-permutation', 'letter-combinations-of-a-phone-number'].flatMap(slug => {
			const id = crypto.randomUUID();
			return [DB.prepare("INSERT INTO problems (id,slug,title,difficulty,topics,summary,search_text,created_at,updated_at) VALUES (?,?,?,'easy','[]','Saved idea.','','now','now')").bind(id, slug, slug),
				attempt.bind(crypto.randomUUID(), id, 'saved', work('return saved_solution'), 'now'), ...row.draft ? [attempt.bind(crypto.randomUUID(), id, 'draft', work('return draft_solution'), null)] : []];
		}));
		await signIn(page);
		const recall = page.getByRole('region', { name: 'Случайное повторение' });
		await expect(recall.getByRole('article')).toHaveCount(5);
		await expect(recall.getByRole('link', { name: 'Повторить', exact: true })).toHaveCount(5);
		await recall.getByRole('link', { name: 'Повторить', exact: true }).first().click();
		await expect(page).toHaveURL(/\/leetcode\/problems\/[a-f0-9-]{36}\/review\?pick=1$/);
		await expect(page.getByText('Решите задачу заново, не подглядывая в старое решение.', { exact: true })).toBeVisible();
		await expect(page.getByText('Saved idea.', { exact: true })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Показать сохранённую работу' })).toHaveCount(0);
		await page.getByRole('button', { name: 'Начать новую попытку', exact: true }).click();
		await expect(page).toHaveURL(/\/leetcode\/problems\/[a-f0-9-]{36}$/);
		await expect(page.getByLabel('Код решения', { exact: true })).toHaveValue(row.code);
	});
}
