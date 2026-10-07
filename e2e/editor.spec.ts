import { test, expect, signIn } from './fixtures';
import type { Env } from '../src/index';

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
	const { DB } = await server.getWorker<Env>().getEnv();
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
