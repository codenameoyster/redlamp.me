import { test, expect, signIn, addTask, type TestEnv } from './fixtures';

test('keeps edits made during a pending save', async ({ page, notebook }) => {
	let release!: () => void, entered!: () => void;
	const held = new Promise<void>(resolve => { release = resolve; });
	const firstSave = new Promise<void>(resolve => { entered = resolve; });
	await page.route(`**/attempts/${notebook.attempt.id}`, async route => {
		if (route.request().method() !== 'PUT') return route.continue();
		const response = await route.fetch(); entered(); await held; await route.fulfill({ response });
	}, { times: 1 });
	await page.getByLabel('Key idea', { exact: true }).fill('First explanation');
	await firstSave;
	await page.getByLabel('Key idea', { exact: true }).fill('Updated explanation');
	release();
	await expect(page.getByRole('status', { name: 'Save state' })).toHaveText('Saved');
	await page.reload();
	await expect(page.getByLabel('Key idea', { exact: true })).toHaveValue('Updated explanation');
});

test('recovers after a failed save and reload', async ({ page, notebook }) => {
	await page.route(`**/attempts/${notebook.attempt.id}`, route => route.request().method() === 'PUT' ? route.abort() : route.continue());
	await page.getByLabel('Key idea', { exact: true }).fill('Recover this explanation');
	await expect(page.getByRole('button', { name: 'Retry save' })).toBeVisible();
	page.once('dialog', dialog => dialog.accept());
	await page.reload();
	await page.getByRole('button', { name: 'Restore unsaved work' }).click();
	await expect(page.getByLabel('Key idea', { exact: true })).toHaveValue('Recover this explanation');
	await expect(page.getByRole('button', { name: 'Retry save' })).toBeVisible();
	await page.unrouteAll();
	await page.getByRole('button', { name: 'Retry save' }).click();
	await expect(page.getByRole('status', { name: 'Save state' })).toHaveText('Saved');
});

test('recognizes a save whose acknowledgement was lost', async ({ page, notebook }) => {
	await page.route(`**/attempts/${notebook.attempt.id}`, async route => {
		if (route.request().method() !== 'PUT') return route.continue();
		await route.fetch(); await route.abort();
	}, { times: 1 });
	await page.getByLabel('Key idea', { exact: true }).fill('Stored before the connection failed');
	await page.getByRole('button', { name: 'Retry save' }).click();
	await expect(page.getByRole('status', { name: 'Save state' })).toHaveText('Saved');
});

test('shows both copies after a two-tab conflict', async ({ page, context, notebook }) => {
	const second = await context.newPage();
	await second.goto(`/leetcode/problems/${notebook.problem.id}`);
	await expect(second.getByLabel('Key idea', { exact: true })).toBeVisible();
	await page.getByLabel('Key idea', { exact: true }).fill('First tab explanation');
	await expect(page.getByRole('status', { name: 'Save state' })).toHaveText('Saved');
	await second.getByLabel('Key idea', { exact: true }).fill('Second tab explanation');
	await expect(second.getByText('First tab explanation', { exact: false }).last()).toBeVisible();
	await expect(second.getByLabel('Key idea', { exact: true })).toHaveValue('Second tab explanation');
	second.once('dialog', dialog => dialog.accept());
	await second.getByRole('button', { name: 'Use server copy' }).click();
	await expect(second.getByLabel('Key idea', { exact: true })).toHaveValue('First tab explanation');
});

test('recovers after the same account signs in', async ({ page, server, notebook }) => {
	await expect(page.getByLabel('Key idea', { exact: true })).toBeVisible();
	await page.clock.install();
	await page.getByLabel('Key idea', { exact: true }).fill('Keep this unsaved explanation');
	const { DB } = await server.getWorker<TestEnv>().getEnv();
	await DB.prepare("DELETE FROM sessions WHERE role='student'").run();
	await page.clock.runFor(1_600);
	await expect(page.getByRole('status', { name: 'Save state' })).toHaveText('Sign in to save');
	await page.getByRole('button', { name: 'Sign in again' }).click();
	await page.getByLabel('Username').fill('student-test');
	await page.getByLabel('Password').fill('student-test-password-01');
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await page.getByRole('button', { name: 'Restore unsaved work' }).click();
	await expect(page.getByLabel('Key idea', { exact: true })).toHaveValue('Keep this unsaved explanation');
	expect(page.url()).toContain(notebook.problem.id);
});

test('saves history and copies it without changing the old attempt', async ({ page, notebook }) => {
	await page.getByLabel('Key idea', { exact: true }).fill('Original explanation');
	await page.getByRole('button', { name: 'Save attempt', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Copy into new draft' })).toBeVisible();
	await page.getByRole('button', { name: 'Copy into new draft' }).click();
	await page.getByLabel('Key idea', { exact: true }).fill('Another explanation');
	await page.getByRole('link', { name: 'Problems', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Problems', exact: true })).toBeVisible();
	const old = await page.request.get(`/leetcode/api/problems/${notebook.problem.id}/attempts/${notebook.attempt.id}`);
	expect((await old.json()).document.approaches[0].idea).toBe('Original explanation');
	await page.goto(`/leetcode/problems/${notebook.problem.id}`);
	await expect(page.getByLabel('Key idea', { exact: true })).toHaveValue('Another explanation');
});

test('keeps parent attempts read-only without recovery', async ({ page, notebook }) => {
	const { id, problemId, version, document, acceptance, understanding } = notebook.attempt;
	const value = { document: { ...document, approaches: [{ ...document.approaches[0], idea: 'Recovered explanation' }] }, acceptance, understanding };
	await page.evaluate(recovery => sessionStorage.setItem(`leetcode:draft:parent-test:${recovery.problemId}`, JSON.stringify(recovery.copy)), { problemId, copy: { attemptId: id, baseVersion: version, value, editedAt: new Date().toISOString() } });
	await signIn(page, 'parent');
	await page.goto(`/leetcode/problems/${notebook.problem.id}`);
	await expect(page.getByLabel('Key idea', { exact: true })).toHaveAttribute('readonly', '');
	await expect(page.getByRole('button', { name: 'Save attempt', exact: true })).toHaveCount(0);
	await expect(page.getByRole('region', { name: 'Recovery copy' })).toHaveCount(0);
});

test('keeps unsaved work while problem metadata refreshes', async ({ page, notebook }) => {
	await page.route(`**/attempts/${notebook.attempt.id}`, route => route.request().method() === 'PUT' ? route.abort() : route.continue());
	await page.getByLabel('Key idea', { exact: true }).fill('Keep the current reasoning');
	await page.getByRole('button', { name: 'Retry save' }).click();
	await page.getByRole('button', { name: 'Edit problem', exact: true }).click();
	await page.getByLabel('Summary', { exact: true }).fill('Updated metadata');
	await page.getByRole('button', { name: 'Save problem', exact: true }).click();
	await expect(page.getByText('Updated metadata', { exact: true })).toBeVisible();
	await expect(page.getByLabel('Key idea', { exact: true })).toHaveValue('Keep the current reasoning');
});

test('protects older recovery when another tab starts a replacement draft', async ({ page, context, notebook }) => {
	const second = await context.newPage();
	await second.goto(`/leetcode/problems/${notebook.problem.id}`);
	await second.getByLabel('Key idea', { exact: true }).fill('The saved server explanation');
	await second.getByRole('button', { name: 'Save attempt', exact: true }).click();
	await expect(second.getByRole('button', { name: 'Copy into new draft' })).toBeVisible();
	await second.getByRole('button', { name: 'Start another attempt' }).click();
	await expect(second.getByLabel('Key idea', { exact: true })).toBeEditable();
	await page.getByLabel('Key idea', { exact: true }).fill('Keep the older unsaved explanation');
	await expect(page.getByRole('status', { name: 'Save state' })).toHaveText('Conflicting edits');
	page.once('dialog', dialog => dialog.accept());
	await page.reload();
	await expect(page.getByRole('region', { name: 'Recovery copy' })).toContainText('Keep the older unsaved explanation');
	await expect(page.getByLabel('Key idea', { exact: true })).toBeDisabled();
	expect(await page.evaluate(id => JSON.parse(sessionStorage.getItem(`leetcode:draft:student-test:${id}`)!).value.document.approaches[0].idea, notebook.problem.id)).toBe('Keep the older unsaved explanation');
	page.once('dialog', dialog => dialog.accept());
	await page.getByRole('button', { name: 'Use server copy', exact: true }).click();
	await page.getByLabel('Key idea', { exact: true }).fill('Replacement draft explanation');
	await expect(page.getByRole('status', { name: 'Save state' })).toHaveText('Saved');
	await page.reload();
	await expect(page.getByLabel('Key idea', { exact: true })).toHaveValue('Replacement draft explanation');
});

test('opens a finalized server copy as read-only after a conflict', async ({ page, context, notebook }) => {
	const second = await context.newPage();
	await second.goto(`/leetcode/problems/${notebook.problem.id}`);
	await second.getByRole('button', { name: 'Save attempt', exact: true }).click();
	await expect(second.getByRole('button', { name: 'Copy into new draft' })).toBeVisible();
	await page.getByLabel('Key idea', { exact: true }).fill('Local explanation');
	await expect(page.getByRole('status', { name: 'Save state' })).toHaveText('Conflicting edits');
	page.once('dialog', dialog => dialog.accept());
	await page.getByRole('button', { name: 'Use server copy', exact: true }).click();
	await expect(page.getByLabel('Key idea', { exact: true })).toHaveAttribute('readonly', '');
	await expect(page.getByRole('button', { name: 'Copy into new draft' })).toBeVisible();
});

const reminders = [
	{ name: 'save keeps a newer reminder when unchanged', button: 'Save attempt', initial: null, clear: false, expected: '2026-11-15' },
	{ name: 'submission keeps a newer reminder when unchanged', button: 'Submit for review', initial: null, clear: false, expected: '2026-11-15' },
	{ name: 'save can explicitly clear a reminder', button: 'Save attempt', initial: '2026-11-01', clear: true, expected: null },
	{ name: 'submission can explicitly clear a reminder', button: 'Submit for review', initial: '2026-11-01', clear: true, expected: null },
];
for (const row of reminders) {
	test(row.name, async ({ page, notebook, server }) => {
		const { DB } = await server.getWorker<TestEnv>().getEnv();
		const review = DB.prepare('UPDATE problems SET next_review_date=? WHERE id=?');
		await review.bind(row.initial, notebook.problem.id).run();
		await addTask(DB, notebook.problem.id);
		await page.reload();
		await expect(page.getByLabel('Next review', { exact: true })).toHaveValue(row.initial ?? '');
		await review.bind('2026-11-15', notebook.problem.id).run();
		await page.getByLabel('Key idea', { exact: true }).fill('Keep the current reminder unless I change it.');
		if (row.clear) await page.getByLabel('Next review', { exact: true }).fill('');
		await page.getByRole('button', { name: row.button, exact: true }).click();
		await expect(page.getByRole('button', { name: 'Copy into new draft' })).toBeVisible();
		expect(await (await page.request.get(`/leetcode/api/problems/${notebook.problem.id}`)).json()).toMatchObject({ nextReviewDate: row.expected });
	});
}

const failedFinalActions = [
	{ name: 'retries a failed attempt save', endpoint: '**/attempts/*/save', button: 'Save attempt', retry: 'Retry save attempt', stored: false, state: 'assigned', submissions: 0 },
	{ name: 'retries a failed submission', endpoint: '**/tasks/*/submit', button: 'Submit for review', retry: 'Retry submission', stored: false, state: 'submitted', submissions: 1 },
	{ name: 'recognizes a finalized attempt after a lost acknowledgement', endpoint: '**/attempts/*/save', button: 'Save attempt', retry: 'Retry save attempt', stored: true, state: 'assigned', submissions: 0 },
	{ name: 'recognizes a submission after a lost acknowledgement', endpoint: '**/tasks/*/submit', button: 'Submit for review', retry: 'Retry submission', stored: true, state: 'submitted', submissions: 1 },
];
for (const row of failedFinalActions) {
	test(row.name, async ({ page, notebook, server }) => {
		const { DB } = await server.getWorker<TestEnv>().getEnv(), { taskId } = await addTask(DB, notebook.problem.id);
		await page.reload();
		await page.getByLabel('Key idea', { exact: true }).fill('A complete explanation');
		await expect(page.getByRole('status', { name: 'Save state' })).toHaveText('Saved');
		await page.route(row.endpoint, async route => { if (row.stored) await route.fetch(); await route.abort(); }, { times: 1 });
		await page.getByRole('button', { name: row.button, exact: true }).click();
		await page.getByRole('button', { name: row.retry, exact: true }).click();
		await expect(page.getByRole('button', { name: 'Copy into new draft' })).toBeVisible();
		const response = await (await page.request.get(`/leetcode/api/tasks/${taskId}`)).json();
		expect(response.task.state).toBe(row.state); expect(response.submissions).toHaveLength(row.submissions);
	});
}

const rejectedFinalActions = [
	{ name: 'recovers login after attempt-save rejection', endpoint: '**/attempts/*/save', button: 'Save attempt', state: 'assigned', submissions: 0 },
	{ name: 'recovers login after submission rejection', endpoint: '**/tasks/*/submit', button: 'Submit for review', state: 'submitted', submissions: 1 },
];
for (const row of rejectedFinalActions) {
	test(row.name, async ({ page, notebook, server }) => {
		const { DB } = await server.getWorker<TestEnv>().getEnv(), { taskId } = await addTask(DB, notebook.problem.id);
		await page.reload();
		await page.getByLabel('Key idea', { exact: true }).fill('A complete explanation');
		await expect(page.getByRole('status', { name: 'Save state' })).toHaveText('Saved');
		await page.route(row.endpoint, route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'login', message: 'Sign in again.' } }) }), { times: 1 });
		await page.getByRole('button', { name: row.button, exact: true }).click();
		await page.getByRole('button', { name: 'Sign in again', exact: true }).click();
		await page.getByLabel('Username').fill('student-test'); await page.getByLabel('Password').fill('student-test-password-01');
		await page.getByRole('button', { name: 'Sign in', exact: true }).click();
		await expect(page.getByLabel('Key idea', { exact: true })).toHaveValue('A complete explanation');
		await page.getByRole('button', { name: row.button, exact: true }).click();
		await expect(page.getByRole('button', { name: 'Copy into new draft' })).toBeVisible();
		const response = await (await page.request.get(`/leetcode/api/tasks/${taskId}`)).json();
		expect(response.task.state).toBe(row.state); expect(response.submissions).toHaveLength(row.submissions);
	});
}

test('retries a submission with the changed task version', async ({ page, notebook, server }) => {
	const { DB } = await server.getWorker<TestEnv>().getEnv(), { taskId } = await addTask(DB, notebook.problem.id);
	await page.reload();
	await page.getByLabel('Key idea', { exact: true }).fill('A complete explanation');
	await expect(page.getByRole('status', { name: 'Save state' })).toHaveText('Saved');
	await DB.prepare("UPDATE homework_tasks SET state='in_progress',version=version+1 WHERE id=?").bind(taskId).run();
	await page.getByRole('button', { name: 'Submit for review', exact: true }).click();
	await expect(page.getByText('In progress', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Retry submission', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Copy into new draft' })).toBeVisible();
	expect((await (await page.request.get(`/leetcode/api/tasks/${taskId}`)).json()).task.state).toBe('submitted');
});

test('hides the submission retry after the task is cancelled', async ({ page, notebook, server }) => {
	const { DB } = await server.getWorker<TestEnv>().getEnv(), { taskId } = await addTask(DB, notebook.problem.id);
	await page.reload();
	await page.getByLabel('Key idea', { exact: true }).fill('A complete explanation');
	await expect(page.getByRole('status', { name: 'Save state' })).toHaveText('Saved');
	await DB.prepare("UPDATE homework_tasks SET state='cancelled',version=version+1 WHERE id=?").bind(taskId).run();
	await page.getByRole('button', { name: 'Submit for review', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Submit for review', exact: true })).toHaveCount(0);
	await expect(page.getByRole('alert')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Retry submission', exact: true })).toHaveCount(0);
	expect((await (await page.request.get(`/leetcode/api/tasks/${taskId}`)).json()).task.state).toBe('cancelled');
});

test('shows the server copy when another tab changed the draft before the attempt save', async ({ page, context, notebook }) => {
	await page.getByLabel('Key idea', { exact: true }).fill('A complete explanation');
	await expect(page.getByRole('status', { name: 'Save state' })).toHaveText('Saved');
	const second = await context.newPage();
	await second.goto(`/leetcode/problems/${notebook.problem.id}`);
	await second.getByLabel('Key idea', { exact: true }).fill('Second tab explanation');
	await expect(second.getByRole('status', { name: 'Save state' })).toHaveText('Saved');
	await page.getByRole('button', { name: 'Save attempt', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Use server copy', exact: true })).toBeVisible();
	await expect(page.getByText('Second tab explanation')).toBeVisible();
	await expect(page.getByLabel('Key idea', { exact: true })).toHaveValue('A complete explanation');
	await expect(page.getByRole('button', { name: 'Retry save attempt', exact: true })).toHaveCount(0);
});

test('drops recovery when edits return to the server copy', async ({ page, notebook }) => {
	const idea = page.getByLabel('Key idea', { exact: true });
	await idea.fill('x'); await idea.fill('');
	await expect(page.getByRole('status', { name: 'Save state' })).toHaveText('Saved');
	expect(await page.evaluate(id => sessionStorage.getItem(`leetcode:draft:student-test:${id}`), notebook.problem.id)).toBeNull();
	await page.getByRole('button', { name: 'Save attempt', exact: true }).click();
	await page.getByRole('button', { name: 'Copy into new draft' }).click();
	await expect(idea).toBeEditable();
	await expect(page.getByRole('region', { name: 'Recovery copy' })).toHaveCount(0);
	await expect(page.getByRole('status', { name: 'Save state' })).toHaveText('Saved');
});

test('drops recovery when a reload shows that the server stored a save whose acknowledgement was lost', async ({ page, notebook }) => {
	const idea = page.getByLabel('Key idea', { exact: true });
	await page.route(`**/attempts/${notebook.attempt.id}`, async route => {
		if (route.request().method() !== 'PUT') return route.continue();
		await route.fetch(); await route.abort();
	}, { times: 1 });
	await idea.fill('Stored before the connection failed');
	await expect(page.getByRole('button', { name: 'Retry save' })).toBeVisible();
	page.once('dialog', dialog => dialog.accept());
	await page.reload();
	await expect(idea).toHaveValue('Stored before the connection failed');
	await expect(page.getByRole('status', { name: 'Save state' })).toHaveText('Saved');
	expect(await page.evaluate(id => sessionStorage.getItem(`leetcode:draft:student-test:${id}`), notebook.problem.id)).toBeNull();
	await page.getByRole('button', { name: 'Save attempt', exact: true }).click();
	await page.getByRole('button', { name: 'Copy into new draft' }).click();
	await expect(idea).toBeEditable();
	await expect(page.getByRole('region', { name: 'Recovery copy' })).toHaveCount(0);
	await expect(page.getByRole('status', { name: 'Save state' })).toHaveText('Saved');
});

test('keeps the autosave limit after edits return to the server copy', async ({ page, notebook }) => {
	const idea = page.getByLabel('Key idea', { exact: true }), attempt = async () => (await page.request.get(`/leetcode/api/problems/${notebook.problem.id}/attempts/${notebook.attempt.id}`)).json();
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
	await page.getByLabel('Key idea', { exact: true }).fill('First tab explanation');
	await expect(page.getByRole('button', { name: 'Retry save' })).toBeVisible();
	const second = await context.newPage();
	await second.goto(`/leetcode/problems/${notebook.problem.id}`);
	await second.getByLabel('Key idea', { exact: true }).fill('Second tab explanation');
	await expect(second.getByRole('status', { name: 'Save state' })).toHaveText('Saved');
	await page.unrouteAll();
	page.once('dialog', dialog => dialog.accept());
	await page.reload();
	await page.getByRole('button', { name: 'Restore unsaved work' }).click();
	await expect(page.getByRole('status', { name: 'Save state' })).toHaveText('Conflicting edits');
	await expect(page.getByRole('button', { name: 'Copy unsaved work' })).toBeVisible();
	page.once('dialog', dialog => dialog.accept());
	await page.reload();
	await page.getByRole('button', { name: 'Restore unsaved work' }).click();
	await expect(page.getByRole('status', { name: 'Save state' })).toHaveText('Conflicting edits');
	await expect(page.getByLabel('Key idea', { exact: true })).toHaveValue('First tab explanation');
	const server = await page.request.get(`/leetcode/api/problems/${notebook.problem.id}/attempts/${notebook.attempt.id}`);
	expect((await server.json()).document.approaches[0].idea).toBe('Second tab explanation');
});

test('removes a start error after the attempt save succeeds', async ({ page, notebook }) => {
	await page.getByLabel('Key idea', { exact: true }).fill('Saved explanation');
	await page.getByRole('button', { name: 'Save attempt', exact: true }).click();
	await page.getByRole('button', { name: 'Start another attempt' }).click();
	await expect(page.getByLabel('Key idea', { exact: true })).toBeEditable();
	await page.getByLabel('Attempt history').selectOption(notebook.attempt.id);
	await page.getByRole('button', { name: 'Copy into new draft' }).click();
	await expect(page.getByRole('alert')).toHaveText('Open the current draft before starting another attempt.');
	await page.getByLabel('Key idea', { exact: true }).fill('Draft explanation');
	await page.getByRole('button', { name: 'Save attempt', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Copy into new draft' })).toBeVisible();
	await expect(page.getByRole('alert')).toHaveCount(0);
});

test('keeps an attempt chosen while the attempt save is pending', async ({ page, notebook }) => {
	await page.getByLabel('Key idea', { exact: true }).fill('Saved explanation');
	await page.getByRole('button', { name: 'Save attempt', exact: true }).click();
	await page.getByRole('button', { name: 'Copy into new draft' }).click();
	await page.getByLabel('Key idea', { exact: true }).fill('Draft explanation');
	await expect(page.getByRole('status', { name: 'Save state' })).toHaveText('Saved');
	let release!: () => void, entered!: () => void;
	const held = new Promise<void>(resolve => { release = resolve; });
	const pending = new Promise<void>(resolve => { entered = resolve; });
	await page.route('**/attempts/*/save', async route => { entered(); await held; await route.continue(); }, { times: 1 });
	await page.getByRole('button', { name: 'Save attempt', exact: true }).click();
	await pending;
	const history = page.getByLabel('Attempt history');
	await history.selectOption(notebook.attempt.id);
	await expect(page.getByLabel('Key idea', { exact: true })).toHaveValue('Saved explanation');
	release();
	await expect(history.locator('option', { hasText: 'Saved attempt 2' })).toHaveCount(1);
	await expect(history).toHaveValue(notebook.attempt.id);
	await expect(page.getByLabel('Key idea', { exact: true })).toHaveValue('Saved explanation');
});
