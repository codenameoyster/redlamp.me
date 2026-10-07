import { test, expect, signIn, type TestEnv } from './fixtures';

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

test('keeps parent attempts read-only and hides student recovery', async ({ page, notebook }) => {
	await page.evaluate(({ id }) => sessionStorage.setItem(`leetcode:draft:student-test:${id}`, 'private recovery'), notebook.problem);
	await signIn(page, 'parent');
	await page.goto(`/leetcode/problems/${notebook.problem.id}`);
	await expect(page.getByLabel('Key idea', { exact: true })).toHaveAttribute('readonly', '');
	await expect(page.getByRole('button', { name: 'Save attempt', exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Restore unsaved work' })).toHaveCount(0);
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
	{ name: 'save keeps a newer reminder when unchanged', action: 'save', initial: null, clear: false, expected: '2026-11-15' },
	{ name: 'submission keeps a newer reminder when unchanged', action: 'submit', initial: null, clear: false, expected: '2026-11-15' },
	{ name: 'save can explicitly clear a reminder', action: 'save', initial: '2026-11-01', clear: true, expected: null },
	{ name: 'submission can explicitly clear a reminder', action: 'submit', initial: '2026-11-01', clear: true, expected: null },
];
for (const row of reminders) {
	test(row.name, async ({ page, notebook, baseURL, server }) => {
		const headers = { Origin: new URL(baseURL!).origin };
		let version = 1;
		if (row.initial) {
			const response = await page.request.patch(`/leetcode/api/problems/${notebook.problem.id}/review-date`, { headers, data: { version, nextReviewDate: row.initial } });
			expect(response.status()).toBe(200); version++;
		}
		if (row.action === 'submit') {
			const { DB } = await server.getWorker<TestEnv>().getEnv();
			await DB.prepare("INSERT INTO homework (id,problem_id,instructions,state,created_at,updated_at) VALUES (?,?,'Explain','assigned','now','now')").bind(crypto.randomUUID(), notebook.problem.id).run();
		}
		await page.reload();
		await expect(page.getByLabel('Next review', { exact: true })).toHaveValue(row.initial ?? '');
		const changed = await page.request.patch(`/leetcode/api/problems/${notebook.problem.id}/review-date`, { headers, data: { version, nextReviewDate: '2026-11-15' } });
		expect(changed.status()).toBe(200);
		await page.getByLabel('Key idea', { exact: true }).fill('Keep the current reminder unless I change it.');
		if (row.clear) await page.getByLabel('Next review', { exact: true }).fill('');
		await page.getByRole('button', { name: row.action === 'save' ? 'Save attempt' : 'Submit for review', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Copy into new draft' })).toBeVisible();
		expect(await (await page.request.get(`/leetcode/api/problems/${notebook.problem.id}`)).json()).toMatchObject({ nextReviewDate: row.expected });
	});
}

const finalActions = [
	{ name: 'retries a failed attempt save', action: 'save', failure: 'unavailable', retry: 'Retry save attempt' },
	{ name: 'retries a failed submission', action: 'submit', failure: 'unavailable', retry: 'Retry submission' },
	{ name: 'recovers login after attempt-save rejection', action: 'save', failure: 'login', retry: 'Sign in again' },
	{ name: 'recovers login after submission rejection', action: 'submit', failure: 'login', retry: 'Sign in again' },
	{ name: 'recognizes a finalized attempt after a lost acknowledgement', action: 'save', failure: 'lost', retry: 'Retry save attempt' },
	{ name: 'recognizes a submission after a lost acknowledgement', action: 'submit', failure: 'lost', retry: 'Retry submission' },
];
for (const row of finalActions) {
	test(row.name, async ({ page, notebook, server }) => {
		let homeworkId = '';
		if (row.action === 'submit') {
			const { DB } = await server.getWorker<TestEnv>().getEnv();
			homeworkId = crypto.randomUUID();
			await DB.prepare("INSERT INTO homework (id,problem_id,instructions,state,created_at,updated_at) VALUES (?,?,'Explain','assigned','now','now')").bind(homeworkId, notebook.problem.id).run();
			await page.reload();
		}
		await page.getByLabel('Key idea', { exact: true }).fill('A complete explanation');
		await expect(page.getByRole('status', { name: 'Save state' })).toHaveText('Saved');
		await page.route(row.action === 'save' ? '**/attempts/*/save' : '**/homework/*/submit', async route => {
			if (row.failure === 'lost') { await route.fetch(); await route.abort(); }
			else await route.fulfill({ status: row.failure === 'login' ? 401 : 503, contentType: 'application/json', body: JSON.stringify({ error: { code: row.failure, message: 'The action could not finish.' } }) });
		}, { times: 1 });
		const actionLabel = row.action === 'save' ? 'Save attempt' : 'Submit for review';
		await page.getByRole('button', { name: actionLabel, exact: true }).click();
		await page.getByRole('button', { name: row.retry, exact: true }).click();
		if (row.failure === 'login') {
			await page.getByLabel('Username').fill('student-test'); await page.getByLabel('Password').fill('student-test-password-01');
			await page.getByRole('button', { name: 'Sign in', exact: true }).click();
			await expect(page.getByLabel('Key idea', { exact: true })).toHaveValue('A complete explanation');
			await page.getByRole('button', { name: actionLabel, exact: true }).click();
		}
		await expect(page.getByRole('button', { name: 'Copy into new draft' })).toBeVisible();
		if (homeworkId) {
			const response = await (await page.request.get(`/leetcode/api/homework/${homeworkId}`)).json();
			expect(response.homework.state).toBe('submitted'); expect(response.submissions).toHaveLength(1);
		}
	});
}
