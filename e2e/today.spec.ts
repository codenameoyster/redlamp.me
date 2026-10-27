import { test, expect, addTask, signIn, type TestEnv } from './fixtures';

test('counts each solved problem once across legacy Hash Table topics', async ({ page, server }) => {
	const { DB } = await server.getWorker<TestEnv>().getEnv();
	const problems = [
		{ name: 'canonical', topics: ['Hash Table'], understanding: 'independent', archived: 0, accepted: 1 },
		{ name: 'joined alias', topics: ['HashTable'], understanding: 'independent', archived: 0, accepted: 2 },
		{ name: 'Russian alias', topics: ['Хеш-таблица'], understanding: 'with_help', archived: 0, accepted: 1 },
		{ name: 'all aliases', topics: ['Hash Table', 'HashTable', 'Хеш-таблица'], understanding: 'independent', archived: 0, accepted: 1 },
		{ name: 'archived', topics: ['HashTable'], understanding: 'independent', archived: 1, accepted: 1 },
		{ name: 'not accepted', topics: ['Хеш-таблица'], understanding: 'independent', archived: 0, accepted: 0 },
	];
	for (const row of problems) {
		const id = crypto.randomUUID();
		await DB.prepare("INSERT INTO problems (id,slug,title,difficulty,topics,summary,search_text,understanding,archived_at,created_at,updated_at) VALUES (?,?,?,'easy',?,'','',?,?,'now','now')").bind(id, id, row.name, JSON.stringify(row.topics), row.understanding, row.archived ? 'now' : null).run();
		for (let i = 0; i < row.accepted; i++) await DB.prepare("INSERT INTO attempts (id,problem_id,state,document,search_text,acceptance,understanding,saved_at,created_at,updated_at) VALUES (?,?,'saved','{}','','accepted',?,'now','now','now')").bind(crypto.randomUUID(), id, row.understanding).run();
	}
	const stored = await DB.prepare('SELECT id,problem_id,document,acceptance,understanding FROM attempts ORDER BY id').all();
	await signIn(page);
	const progress = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Понимание тем', exact: true }) });
	await expect(progress.getByRole('progressbar')).toHaveCount(1);
	const hashTable = progress.getByRole('progressbar', { name: 'Hash Table: решено самостоятельно', exact: true });
	await expect(hashTable).toHaveAttribute('value', '3');
	await expect(hashTable).toHaveAttribute('max', '4');
	await expect(progress.getByText('3 / 4', { exact: true })).toBeVisible();
	expect((await DB.prepare('SELECT id,problem_id,document,acceptance,understanding FROM attempts ORDER BY id').all()).results).toEqual(stored.results);
});

const dueDates = [
	{ name: 'submitted homework past its due date is not overdue', state: 'submitted', due: 'Срок 2020-01-01' },
	{ name: 'assigned homework past its due date is overdue', state: 'assigned', due: 'Срок 2020-01-01 - Просрочено' },
];
for (const row of dueDates) {
	test(row.name, async ({ page, server, notebook }) => {
		const { DB } = await server.getWorker<TestEnv>().getEnv();
		await addTask(DB, notebook.problem.id, row.state, '2020-01-01');
		await page.goto('/leetcode');
		await expect(page.getByText(row.due, { exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { level: 3, name: notebook.problem.title }).getByRole('link')).toHaveAttribute('href', `/leetcode/problems/${notebook.problem.id}`);
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

const focus = [
	{ name: 'draft of a task opens the problem window', task: 'in_progress' },
	{ name: 'draft of a library problem opens the problem window', task: null },
	{ name: 'draft beside a submitted task opens the problem window', task: 'submitted' },
];
for (const row of focus) {
	test(row.name, async ({ page, server, notebook }) => {
		const { DB } = await server.getWorker<TestEnv>().getEnv();
		if (row.task) await addTask(DB, notebook.problem.id, row.task);
		await page.goto('/leetcode');
		await expect(page.getByRole('link', { name: 'Продолжить работу', exact: true })).toHaveAttribute('href', `/leetcode/problems/${notebook.problem.id}`);
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
	await expect(badges.getByRole('listitem')).toHaveCount(17);
	await expect(badges.getByRole('listitem').filter({ hasText: 'Первая принятая' })).toBeVisible();
	await expect(badges.getByRole('listitem').filter({ hasText: 'Первая принятая' }).getByRole('img', { name: 'Не получен' })).toHaveCount(0);
	await expect(badges.getByRole('img', { name: 'Не получен' })).toHaveCount(16);
	const chip = page.getByRole('banner').getByRole('progressbar', { name: 'Прогресс до уровня 2', exact: true });
	await expect(chip).toHaveAttribute('value', '10');
	await page.setViewportSize({ width: 1024, height: 1000 });
	expect((await chip.boundingBox())!.width).toBe(96);
});

test('shows the late tasks in the level card', async ({ page, server, notebook }) => {
	const { DB } = await server.getWorker<TestEnv>().getEnv();
	const { taskId } = await addTask(DB, notebook.problem.id, 'assigned', '2020-01-01');
	await DB.prepare("UPDATE homework_tasks SET created_at='2019-12-01T00:00:00.000Z' WHERE id=?").bind(taskId).run();
	await page.goto('/leetcode');
	await expect(page.getByText('Просрочено: 1 (−15 XP каждое)', { exact: true })).toBeVisible();
});

test('shows the missed days in the level card', async ({ page, server, notebook }) => {
	void notebook;
	const { DB } = await server.getWorker<TestEnv>().getEnv();
	// The first visit was 3 days ago. The page load records today, so the 2 days between are missed.
	await DB.prepare("INSERT INTO visits (day) VALUES (date('now','-3 day'))").run();
	await page.goto('/leetcode');
	await expect(page.getByText('Пропущено дней: 2 (−5 XP каждый)', { exact: true })).toBeVisible();
});

const picks = [
	{ name: 'library pick hides the saved work and starts a new attempt', control: 'link' as const, draft: false, states: ['draft', 'saved'] },
	{ name: 'library pick with a draft saves the draft and starts a new attempt', control: 'link' as const, draft: true, states: ['draft', 'saved', 'saved'] },
	{ name: 'set task pick adds the problem and starts a new attempt', control: 'button' as const, draft: false, states: ['draft'] },
];
for (const row of picks) {
	test(row.name, async ({ page, server }) => {
		const { DB } = await server.getWorker<TestEnv>().getEnv();
		const work = (code: string) => JSON.stringify({ notes: '', approaches: [{ id: crypto.randomUUID(), label: '', idea: '', correctness: '', timeComplexity: '', spaceComplexity: '', edgeCases: '', mistakes: '', language: 'python', code }] });
		const attempt = DB.prepare("INSERT INTO attempts (id,problem_id,state,document,search_text,acceptance,understanding,saved_at,created_at,updated_at) VALUES (?,?,?,?,'','accepted','with_help',?,'now','now')");
		await DB.batch(['sum-of-all-subset-xor-totals', 'letter-case-permutation', 'letter-combinations-of-a-phone-number'].flatMap(slug => {
			const id = crypto.randomUUID();
			return [DB.prepare("INSERT INTO problems (id,slug,title,difficulty,topics,summary,search_text,created_at,updated_at) VALUES (?,?,?,'easy','[]','Saved idea.','','now','now')").bind(id, slug, slug),
				attempt.bind(crypto.randomUUID(), id, 'saved', work('return saved_solution'), 'now'), ...row.draft ? [attempt.bind(crypto.randomUUID(), id, 'draft', work('return draft_solution'), null)] : []];
		}));
		await signIn(page);
		await page.route('**/leetcode/api/problems/*/tests', route => route.fulfill({ json: { spec: null, source: 'none', standard: [], own: [], skeleton: '' } }));
		const recall = page.getByRole('region', { name: 'Случайное повторение' });
		await expect(recall.getByRole('article')).toHaveCount(5);
		await expect(recall.getByRole('link', { name: 'Повторить', exact: true })).toHaveCount(2);
		await expect(recall.getByRole('button', { name: 'Повторить', exact: true })).toHaveCount(3);
		await recall.getByRole(row.control, { name: 'Повторить', exact: true }).first().click();
		await expect(page).toHaveURL(/\/leetcode\/problems\/[a-f0-9-]{36}\/review\?pick=1$/);
		await expect(page.getByText('Решите задачу заново, не подглядывая в старое решение.', { exact: true })).toBeVisible();
		await expect(page.getByText('Saved idea.', { exact: true })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Показать сохранённую работу' })).toHaveCount(0);
		await page.getByRole('button', { name: 'Начать новую попытку', exact: true }).click();
		await expect(page).toHaveURL(/\/leetcode\/problems\/[a-f0-9-]{36}$/);
		await expect(page.getByLabel('Код решения', { exact: true })).toHaveText('');
		const attempts = await (await page.request.get(`/leetcode/api/problems/${page.url().split('/').at(-1)}/attempts`)).json() as { items: { state: string }[] };
		expect(attempts.items.map(attempt => attempt.state)).toEqual(row.states);
	});
}
