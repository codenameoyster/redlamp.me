import { test, expect, signIn, addTask, type TestEnv } from './fixtures';

test('keeps edits made during a pending save', async ({ page, notebook }) => {
	let release!: () => void, entered!: () => void;
	const held = new Promise<void>(resolve => { release = resolve; });
	const firstSave = new Promise<void>(resolve => { entered = resolve; });
	await page.route(`**/attempts/${notebook.attempt.id}`, async route => {
		if (route.request().method() !== 'PUT') return route.continue();
		const response = await route.fetch(); entered(); await held; await route.fulfill({ response });
	}, { times: 1 });
	await page.getByLabel('Основная идея', { exact: true }).fill('First explanation');
	await firstSave;
	await page.getByLabel('Основная идея', { exact: true }).fill('Updated explanation');
	release();
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
	await page.reload();
	await expect(page.getByLabel('Основная идея', { exact: true })).toHaveValue('Updated explanation');
});

test('recovers after a failed save and reload', async ({ page, notebook }) => {
	await page.route(`**/attempts/${notebook.attempt.id}`, route => route.request().method() === 'PUT' ? route.abort() : route.continue());
	await page.getByLabel('Основная идея', { exact: true }).fill('Recover this explanation');
	await expect(page.getByRole('button', { name: 'Повторить сохранение' })).toBeVisible();
	page.once('dialog', dialog => dialog.accept());
	await page.reload();
	await page.getByRole('button', { name: 'Восстановить несохранённую работу' }).click();
	await expect(page.getByLabel('Основная идея', { exact: true })).toHaveValue('Recover this explanation');
	await expect(page.getByRole('button', { name: 'Повторить сохранение' })).toBeVisible();
	await page.unrouteAll();
	await page.getByRole('button', { name: 'Повторить сохранение' }).click();
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
});

test('recognizes a save whose acknowledgement was lost', async ({ page, notebook }) => {
	await page.route(`**/attempts/${notebook.attempt.id}`, async route => {
		if (route.request().method() !== 'PUT') return route.continue();
		await route.fetch(); await route.abort();
	}, { times: 1 });
	await page.getByLabel('Основная идея', { exact: true }).fill('Stored before the connection failed');
	await page.getByRole('button', { name: 'Повторить сохранение' }).click();
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
});

test('shows both copies after a two-tab conflict', async ({ page, context, notebook }) => {
	const second = await context.newPage();
	await second.goto(`/leetcode/problems/${notebook.problem.id}`);
	await expect(second.getByLabel('Основная идея', { exact: true })).toBeVisible();
	await page.getByLabel('Основная идея', { exact: true }).fill('First tab explanation');
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
	await second.getByLabel('Основная идея', { exact: true }).fill('Second tab explanation');
	await expect(second.getByText('First tab explanation', { exact: false }).last()).toBeVisible();
	await expect(second.getByLabel('Основная идея', { exact: true })).toHaveValue('Second tab explanation');
	second.once('dialog', dialog => dialog.accept());
	await second.getByRole('button', { name: 'Использовать копию с сервера' }).click();
	await expect(second.getByLabel('Основная идея', { exact: true })).toHaveValue('First tab explanation');
});

test('recovers after the same account signs in', async ({ page, server, notebook }) => {
	await expect(page.getByLabel('Основная идея', { exact: true })).toBeVisible();
	await page.clock.install();
	await page.getByLabel('Основная идея', { exact: true }).fill('Keep this unsaved explanation');
	const { DB } = await server.getWorker<TestEnv>().getEnv();
	await DB.prepare("DELETE FROM sessions WHERE role='student'").run();
	await page.clock.runFor(1_600);
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Войдите, чтобы сохранить');
	await page.getByRole('button', { name: 'Войти снова' }).click();
	await page.getByLabel('Имя пользователя').fill('student-test');
	await page.getByLabel('Пароль').fill('student-test-password-01');
	await page.getByRole('button', { name: 'Войти', exact: true }).click();
	await page.getByRole('button', { name: 'Восстановить несохранённую работу' }).click();
	await expect(page.getByLabel('Основная идея', { exact: true })).toHaveValue('Keep this unsaved explanation');
	expect(page.url()).toContain(notebook.problem.id);
});

test('saves an attempt and keeps the work in a new copy', async ({ page, notebook }) => {
	await page.getByLabel('Основная идея', { exact: true }).fill('Original explanation');
	await page.getByRole('button', { name: 'Сохранить попытку', exact: true }).click();
	await expect(page.getByText('Попытка сохранена.', { exact: true })).toBeVisible();
	await expect(page.getByLabel('Основная идея', { exact: true })).toHaveValue('Original explanation');
	await page.getByLabel('Основная идея', { exact: true }).fill('Another explanation');
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
	await page.getByRole('link', { name: 'Задачи', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Задачи', exact: true })).toBeVisible();
	const old = await page.request.get(`/leetcode/api/problems/${notebook.problem.id}/attempts/${notebook.attempt.id}`);
	expect((await old.json()).document.approaches[0].idea).toBe('Original explanation');
	await page.goto(`/leetcode/problems/${notebook.problem.id}`);
	await expect(page.getByLabel('Основная идея', { exact: true })).toHaveValue('Another explanation');
});

test('keeps parent attempts read-only without recovery', async ({ page, notebook }) => {
	const { id, problemId, version, document, acceptance, understanding } = notebook.attempt;
	const value = { document: { ...document, approaches: [{ ...document.approaches[0], idea: 'Recovered explanation' }] }, acceptance, understanding };
	await page.evaluate(recovery => sessionStorage.setItem(`leetcode:draft:parent-test:${recovery.problemId}`, JSON.stringify(recovery.copy)), { problemId, copy: { attemptId: id, baseVersion: version, value, editedAt: new Date().toISOString() } });
	await signIn(page, 'parent');
	await page.goto(`/leetcode/problems/${notebook.problem.id}`);
	await expect(page.getByLabel('Основная идея', { exact: true })).toHaveAttribute('readonly', '');
	await expect(page.getByRole('button', { name: 'Сохранить попытку', exact: true })).toHaveCount(0);
	await expect(page.getByRole('region', { name: 'Копия для восстановления' })).toHaveCount(0);
});

test('keeps unsaved work while problem metadata refreshes', async ({ page, notebook }) => {
	await page.route(`**/attempts/${notebook.attempt.id}`, route => route.request().method() === 'PUT' ? route.abort() : route.continue());
	await page.getByLabel('Основная идея', { exact: true }).fill('Keep the current reasoning');
	await page.getByRole('button', { name: 'Повторить сохранение' }).click();
	await page.getByRole('button', { name: 'Изменить задачу', exact: true }).click();
	await page.getByLabel('Описание', { exact: true }).fill('Updated metadata');
	await page.getByRole('button', { name: 'Сохранить задачу', exact: true }).click();
	await expect(page.getByText('Updated metadata', { exact: true })).toBeVisible();
	await expect(page.getByLabel('Основная идея', { exact: true })).toHaveValue('Keep the current reasoning');
});

test('protects older recovery when another tab starts a replacement draft', async ({ page, context, notebook }) => {
	const second = await context.newPage();
	await second.goto(`/leetcode/problems/${notebook.problem.id}`);
	await second.getByLabel('Основная идея', { exact: true }).fill('The saved server explanation');
	await second.getByRole('button', { name: 'Сохранить попытку', exact: true }).click();
	await expect(second.getByText('Попытка сохранена.', { exact: true })).toBeVisible();
	await page.getByLabel('Основная идея', { exact: true }).fill('Keep the older unsaved explanation');
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Конфликт правок');
	page.once('dialog', dialog => dialog.accept());
	await page.reload();
	await expect(page.getByRole('region', { name: 'Копия для восстановления' })).toContainText('Keep the older unsaved explanation');
	await expect(page.getByLabel('Основная идея', { exact: true })).toBeDisabled();
	expect(await page.evaluate(id => JSON.parse(sessionStorage.getItem(`leetcode:draft:student-test:${id}`)!).value.document.approaches[0].idea, notebook.problem.id)).toBe('Keep the older unsaved explanation');
	page.once('dialog', dialog => dialog.accept());
	await page.getByRole('button', { name: 'Использовать копию с сервера', exact: true }).click();
	await page.getByLabel('Основная идея', { exact: true }).fill('Replacement draft explanation');
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
	await page.reload();
	await expect(page.getByLabel('Основная идея', { exact: true })).toHaveValue('Replacement draft explanation');
});

test('opens the new working copy after a conflict with a saved attempt', async ({ page, context, notebook }) => {
	const second = await context.newPage();
	await second.goto(`/leetcode/problems/${notebook.problem.id}`);
	await second.getByLabel('Основная идея', { exact: true }).fill('Second tab explanation');
	await second.getByRole('button', { name: 'Сохранить попытку', exact: true }).click();
	await expect(second.getByText('Попытка сохранена.', { exact: true })).toBeVisible();
	await page.getByLabel('Основная идея', { exact: true }).fill('Local explanation');
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Конфликт правок');
	page.once('dialog', dialog => dialog.accept());
	await page.getByRole('button', { name: 'Использовать копию с сервера', exact: true }).click();
	await expect(page.getByLabel('Основная идея', { exact: true })).toHaveValue('Second tab explanation');
	await expect(page.getByLabel('Основная идея', { exact: true })).toBeEditable();
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
	const attempts = await (await page.request.get(`/leetcode/api/problems/${notebook.problem.id}/attempts`)).json();
	expect(attempts.items.map((attempt: { state: string }) => attempt.state)).toEqual(['draft', 'saved']);
});

const reminders = [
	{ name: 'save keeps a newer reminder when unchanged', button: 'Сохранить попытку', done: 'Попытка сохранена.', initial: null, clear: false, expected: '2026-11-15' },
	{ name: 'submission keeps a newer reminder when unchanged', button: 'Отправить на проверку', done: 'Отправлено', initial: null, clear: false, expected: '2026-11-15' },
	{ name: 'save can explicitly clear a reminder', button: 'Сохранить попытку', done: 'Попытка сохранена.', initial: '2026-11-01', clear: true, expected: null },
	{ name: 'submission can explicitly clear a reminder', button: 'Отправить на проверку', done: 'Отправлено', initial: '2026-11-01', clear: true, expected: null },
];
for (const row of reminders) {
	test(row.name, async ({ page, notebook, server }) => {
		const { DB } = await server.getWorker<TestEnv>().getEnv();
		const review = DB.prepare('UPDATE problems SET next_review_date=? WHERE id=?');
		await review.bind(row.initial, notebook.problem.id).run();
		const { taskId } = await addTask(DB, notebook.problem.id);
		await page.goto(`/leetcode/tasks/${taskId}`);
		await expect(page.getByLabel('Следующее повторение', { exact: true })).toHaveValue(row.initial ?? '');
		await review.bind('2026-11-15', notebook.problem.id).run();
		await page.getByLabel('Основная идея', { exact: true }).fill('Keep the current reminder unless I change it.');
		if (row.clear) await page.getByLabel('Следующее повторение', { exact: true }).fill('');
		await page.getByRole('button', { name: row.button, exact: true }).click();
		await expect(page.getByText(row.done, { exact: true })).toBeVisible();
		expect(await (await page.request.get(`/leetcode/api/problems/${notebook.problem.id}`)).json()).toMatchObject({ nextReviewDate: row.expected });
	});
}

const failedFinalActions = [
	{ name: 'retries a failed attempt save', endpoint: '**/attempts/*/save', button: 'Сохранить попытку', retry: 'Повторить сохранение попытки', done: 'Попытка сохранена.', stored: false, state: 'in_progress', submissions: 0 },
	{ name: 'retries a failed submission', endpoint: '**/tasks/*/submit', button: 'Отправить на проверку', retry: 'Повторить отправку', done: 'Отправлено', stored: false, state: 'submitted', submissions: 1 },
	{ name: 'recognizes a finalized attempt after a lost acknowledgement', endpoint: '**/attempts/*/save', button: 'Сохранить попытку', retry: 'Повторить сохранение попытки', done: 'Попытка сохранена.', stored: true, state: 'in_progress', submissions: 0 },
	{ name: 'recognizes a submission after a lost acknowledgement', endpoint: '**/tasks/*/submit', button: 'Отправить на проверку', retry: 'Повторить отправку', done: 'Отправлено', stored: true, state: 'submitted', submissions: 1 },
];
for (const row of failedFinalActions) {
	test(row.name, async ({ page, notebook, server }) => {
		const { DB } = await server.getWorker<TestEnv>().getEnv(), { taskId } = await addTask(DB, notebook.problem.id);
		await page.goto(`/leetcode/tasks/${taskId}`);
		await expect(page.getByText('В работе', { exact: true })).toBeVisible();
		await page.getByLabel('Основная идея', { exact: true }).fill('A complete explanation');
		await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
		await page.route(row.endpoint, async route => { if (row.stored) await route.fetch(); await route.abort(); }, { times: 1 });
		await page.getByRole('button', { name: row.button, exact: true }).click();
		await page.getByRole('button', { name: row.retry, exact: true }).click();
		await expect(page.getByText(row.done, { exact: true })).toBeVisible();
		const response = await (await page.request.get(`/leetcode/api/tasks/${taskId}`)).json();
		expect(response.task.state).toBe(row.state); expect(response.submissions).toHaveLength(row.submissions);
	});
}

const rejectedFinalActions = [
	{ name: 'recovers login after attempt-save rejection', endpoint: '**/attempts/*/save', button: 'Сохранить попытку', done: 'Попытка сохранена.', state: 'in_progress', submissions: 0 },
	{ name: 'recovers login after submission rejection', endpoint: '**/tasks/*/submit', button: 'Отправить на проверку', done: 'Отправлено', state: 'submitted', submissions: 1 },
];
for (const row of rejectedFinalActions) {
	test(row.name, async ({ page, notebook, server }) => {
		const { DB } = await server.getWorker<TestEnv>().getEnv(), { taskId } = await addTask(DB, notebook.problem.id);
		await page.goto(`/leetcode/tasks/${taskId}`);
		await page.getByLabel('Основная идея', { exact: true }).fill('A complete explanation');
		await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
		await page.route(row.endpoint, route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'login', message: 'Sign in again.' } }) }), { times: 1 });
		await page.getByRole('button', { name: row.button, exact: true }).click();
		await page.getByRole('button', { name: 'Войти снова', exact: true }).click();
		await page.getByLabel('Имя пользователя').fill('student-test'); await page.getByLabel('Пароль').fill('student-test-password-01');
		await page.getByRole('button', { name: 'Войти', exact: true }).click();
		await expect(page.getByLabel('Основная идея', { exact: true })).toHaveValue('A complete explanation');
		await page.getByRole('button', { name: row.button, exact: true }).click();
		await expect(page.getByText(row.done, { exact: true })).toBeVisible();
		const response = await (await page.request.get(`/leetcode/api/tasks/${taskId}`)).json();
		expect(response.task.state).toBe(row.state); expect(response.submissions).toHaveLength(row.submissions);
	});
}

test('retries a submission with the changed task version', async ({ page, notebook, server }) => {
	const { DB } = await server.getWorker<TestEnv>().getEnv(), { taskId } = await addTask(DB, notebook.problem.id, 'changes_requested');
	await page.goto(`/leetcode/tasks/${taskId}`);
	await page.getByLabel('Основная идея', { exact: true }).fill('A complete explanation');
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
	await DB.prepare("UPDATE homework_tasks SET state='in_progress',version=version+1 WHERE id=?").bind(taskId).run();
	await page.getByRole('button', { name: 'Отправить на проверку', exact: true }).click();
	await expect(page.getByText('В работе', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Повторить отправку', exact: true }).click();
	await expect(page.getByText('Отправлено', { exact: true })).toBeVisible();
	expect((await (await page.request.get(`/leetcode/api/tasks/${taskId}`)).json()).task.state).toBe('submitted');
});

test('hides the submission retry after the task is cancelled', async ({ page, notebook, server }) => {
	const { DB } = await server.getWorker<TestEnv>().getEnv(), { taskId } = await addTask(DB, notebook.problem.id);
	await page.goto(`/leetcode/tasks/${taskId}`);
	await page.getByLabel('Основная идея', { exact: true }).fill('A complete explanation');
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
	await DB.prepare("UPDATE homework_tasks SET state='cancelled',version=version+1 WHERE id=?").bind(taskId).run();
	await page.getByRole('button', { name: 'Отправить на проверку', exact: true }).click();
	await expect(page.getByText('Отменено', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Отправить на проверку', exact: true })).toBeDisabled();
	await expect(page.getByRole('alert')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Повторить отправку', exact: true })).toHaveCount(0);
	expect((await (await page.request.get(`/leetcode/api/tasks/${taskId}`)).json()).task.state).toBe('cancelled');
});

test('shows the server copy when another tab changed the draft before the attempt save', async ({ page, context, notebook }) => {
	await page.getByLabel('Основная идея', { exact: true }).fill('A complete explanation');
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
	const second = await context.newPage();
	await second.goto(`/leetcode/problems/${notebook.problem.id}`);
	await second.getByLabel('Основная идея', { exact: true }).fill('Second tab explanation');
	await expect(second.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
	await page.getByRole('button', { name: 'Сохранить попытку', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Использовать копию с сервера', exact: true })).toBeVisible();
	await expect(page.getByText('Second tab explanation')).toBeVisible();
	await expect(page.getByLabel('Основная идея', { exact: true })).toHaveValue('A complete explanation');
	await expect(page.getByRole('button', { name: 'Повторить сохранение попытки', exact: true })).toHaveCount(0);
});

test('drops recovery when edits return to the server copy', async ({ page, notebook }) => {
	const idea = page.getByLabel('Основная идея', { exact: true });
	await idea.fill('x'); await idea.fill('');
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
	expect(await page.evaluate(id => sessionStorage.getItem(`leetcode:draft:student-test:${id}`), notebook.problem.id)).toBeNull();
	await page.getByRole('button', { name: 'Сохранить попытку', exact: true }).click();
	await expect(page.getByText('Попытка сохранена.', { exact: true })).toBeVisible();
	await expect(idea).toBeEditable();
	await expect(page.getByRole('region', { name: 'Копия для восстановления' })).toHaveCount(0);
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
});

test('drops recovery when a reload shows that the server stored a save whose acknowledgement was lost', async ({ page, notebook }) => {
	const idea = page.getByLabel('Основная идея', { exact: true });
	await page.route(`**/attempts/${notebook.attempt.id}`, async route => {
		if (route.request().method() !== 'PUT') return route.continue();
		await route.fetch(); await route.abort();
	}, { times: 1 });
	await idea.fill('Stored before the connection failed');
	await expect(page.getByRole('button', { name: 'Повторить сохранение' })).toBeVisible();
	page.once('dialog', dialog => dialog.accept());
	await page.reload();
	await expect(idea).toHaveValue('Stored before the connection failed');
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
	expect(await page.evaluate(id => sessionStorage.getItem(`leetcode:draft:student-test:${id}`), notebook.problem.id)).toBeNull();
	await page.getByRole('button', { name: 'Сохранить попытку', exact: true }).click();
	await expect(page.getByText('Попытка сохранена.', { exact: true })).toBeVisible();
	await expect(idea).toBeEditable();
	await expect(page.getByRole('region', { name: 'Копия для восстановления' })).toHaveCount(0);
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
});

test('keeps the autosave limit after edits return to the server copy', async ({ page, notebook }) => {
	const idea = page.getByLabel('Основная идея', { exact: true }), attempt = async () => (await page.request.get(`/leetcode/api/problems/${notebook.problem.id}/attempts/${notebook.attempt.id}`)).json();
	await page.clock.install();
	await page.clock.pauseAt(Date.now() + 1_000);
	await idea.fill('x'); await idea.fill('');
	await page.clock.runFor(10_500);
	expect((await attempt()).version).toBe(notebook.attempt.version);
	for (let second = 1; second <= 11; second++) { await idea.fill(`Typing for ${second} seconds`); await page.clock.runFor(1_000); }
	await expect.poll(async () => (await attempt()).document.approaches[0].idea).not.toBe('');
});

test('keeps the recovery base version through a restored conflict', async ({ page, context, notebook }) => {
	await page.route(`**/attempts/${notebook.attempt.id}`, route => route.request().method() === 'PUT' ? route.abort() : route.continue());
	await page.getByLabel('Основная идея', { exact: true }).fill('First tab explanation');
	await expect(page.getByRole('button', { name: 'Повторить сохранение' })).toBeVisible();
	const second = await context.newPage();
	await second.goto(`/leetcode/problems/${notebook.problem.id}`);
	await second.getByLabel('Основная идея', { exact: true }).fill('Second tab explanation');
	await expect(second.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
	await page.unrouteAll();
	page.once('dialog', dialog => dialog.accept());
	await page.reload();
	await page.getByRole('button', { name: 'Восстановить несохранённую работу' }).click();
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Конфликт правок');
	await expect(page.getByRole('button', { name: 'Скопировать несохранённую работу' })).toBeVisible();
	page.once('dialog', dialog => dialog.accept());
	await page.reload();
	await page.getByRole('button', { name: 'Восстановить несохранённую работу' }).click();
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Конфликт правок');
	await expect(page.getByLabel('Основная идея', { exact: true })).toHaveValue('First tab explanation');
	const server = await page.request.get(`/leetcode/api/problems/${notebook.problem.id}/attempts/${notebook.attempt.id}`);
	expect((await server.json()).document.approaches[0].idea).toBe('Second tab explanation');
});

test('numbers each line of the code at the top of its wrapped line', async ({ page, notebook }) => {
	await expect(page.getByRole('heading', { name: notebook.problem.title })).toBeVisible();
	await page.getByLabel('Код решения', { exact: true }).fill(`x = 1\n# ${'long_comment_'.repeat(30)}\n\ny = 2`);
	const lines = page.locator('.code-field .lines > div');
	await expect(lines).toHaveCount(4);
	// The comment wraps, so the number of the last line moves down to the highlighted "2".
	const [first, comment, last, two] = await Promise.all([lines.nth(0).boundingBox(), lines.nth(1).boundingBox(), lines.nth(3).boundingBox(), page.locator('.code-field pre .hljs-number').last().boundingBox()]);
	expect(comment!.height).toBeGreaterThan(first!.height * 2);
	expect(Math.abs(last!.y + last!.height / 2 - (two!.y + two!.height / 2))).toBeLessThan(4);
});

test('copies the code', async ({ page, context, notebook }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await expect(page.getByRole('heading', { name: notebook.problem.title })).toBeVisible();
	await page.getByLabel('Код решения', { exact: true }).fill('print(1)\n');
	await page.getByRole('button', { name: 'Скопировать код', exact: true }).click();
	await expect(page.getByText('Код скопирован.', { exact: true })).toBeVisible();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('print(1)\n');
});

const skeleton = 'class Solution:\n    def twoSum(self, nums: list[int], target: int) -> list[int]:\n        ';
const skeletons = [
	{ name: 'fills an empty working copy with the starter code', code: '', expected: skeleton },
	{ name: 'keeps the code of the working copy over the starter code', code: 'print(1)', expected: 'print(1)' },
];
for (const row of skeletons) {
	test(row.name, async ({ page, notebook }) => {
		const code = page.getByLabel('Код решения', { exact: true }), status = page.getByRole('status', { name: 'Состояние сохранения' });
		if (row.code) { await code.fill(row.code); await expect(status).toHaveText('Сохранено'); }
		await page.route('**/leetcode/api/problems/*/tests', route => route.fulfill({ json: { spec: null, source: 'none', standard: [], own: [], skeleton } }));
		await page.goto(`/leetcode/problems/${notebook.problem.id}`);
		await expect(code).toHaveValue(row.expected);
		await expect(status).toHaveText('Сохранено');
		await page.reload();
		await expect(code).toHaveValue(row.expected);
	});
}

test('keeps the recovery copy while the starter code waits', async ({ page, notebook }) => {
	await page.route(`**/attempts/${notebook.attempt.id}`, route => route.request().method() === 'PUT' ? route.abort() : route.continue());
	await page.route('**/leetcode/api/problems/*/tests', route => route.fulfill({ json: { spec: null, source: 'none', standard: [], own: [], skeleton } }));
	await page.getByLabel('Основная идея', { exact: true }).fill('Recover this explanation');
	await expect(page.getByRole('button', { name: 'Повторить сохранение' })).toBeVisible();
	for (let reload = 0; reload < 2; reload++) {
		page.once('dialog', dialog => dialog.accept());
		await page.reload();
		await expect(page.getByRole('button', { name: 'Восстановить несохранённую работу' })).toBeVisible();
	}
	await page.getByRole('button', { name: 'Восстановить несохранённую работу' }).click();
	await expect(page.getByLabel('Основная идея', { exact: true })).toHaveValue('Recover this explanation');
	await expect(page.getByLabel('Код решения', { exact: true })).toHaveValue(skeleton);
});
