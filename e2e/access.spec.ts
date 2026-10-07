import { test, expect, signIn } from './fixtures';

test('logout blocks browser history', async ({ page, notebook }) => {
	await expect(page.getByRole('heading', { name: notebook.problem.title, exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Log out' }).click();
	await expect(page.getByLabel('Password')).toBeVisible();
	await page.goBack();
	await expect(page.getByLabel('Password')).toBeVisible();
	await expect(page.getByLabel('Key idea', { exact: true })).toHaveCount(0);
});

test('reads the signed-in user from the page without a session request', async ({ page }) => {
	await signIn(page);
	const requests: string[] = [];
	page.on('request', request => { if (request.method() === 'GET' && new URL(request.url()).pathname === '/leetcode/api/session') requests.push(request.url()); });
	await page.goto('/leetcode/problems');
	await expect(page.getByText('student-test', { exact: true })).toBeVisible();
	expect(requests).toEqual([]);
});

const returns = [
	{ name: 'returns to the requested page and query after sign-in', path: '/leetcode/problems?due=2026-10-07', url: '/leetcode/problems?due=2026-10-07' },
	{ name: 'stays on the notebook origin for a return URL on another origin', path: `/leetcode/login?return=${encodeURIComponent('https://example.com/leetcode/problems')}`, url: '/leetcode/problems' },
	{ name: 'stays on the notebook origin for a protocol-relative return URL', path: `/leetcode/login?return=${encodeURIComponent('//example.com/leetcode/problems')}`, url: '/leetcode/problems' },
	{ name: 'ignores a return path outside the notebook pages', path: '/leetcode/missing', url: '/leetcode' },
];
for (const row of returns) {
	test(row.name, async ({ page }) => {
		await page.goto(row.path);
		await page.getByLabel('Username').fill('student-test');
		await page.getByLabel('Password').fill('student-test-password-01');
		await page.getByRole('button', { name: 'Sign in', exact: true }).click();
		await expect(page).toHaveURL(row.url);
	});
}

const statuses = [
	{ name: 'private lesson content requires login', path: '/leetcode/api/lessons/11111111-1111-4111-8111-111111111111/content', status: 401 },
	{ name: 'public site is open', path: '/', status: 200 },
	{ name: 'notebook script is open', path: '/leetcode/assets/main.js', status: 200 },
];
for (const row of statuses) {
	test(row.name, async ({ request }) => {
		expect((await request.get(row.path)).status()).toBe(row.status);
	});
}

const aliases = [
	{ name: 'notebook slash', path: '/leetcode/' },
	{ name: 'notebook index', path: '/leetcode/index.html' },
	{ name: 'root HTML alias', path: '/leetcode.html' },
	{ name: 'library HTML alias', path: '/leetcode/problems.html' },
];
for (const { name, path } of aliases) {
	test(`${name} requires login with real assets`, async ({ request }) => {
		const response = await request.get(path, { maxRedirects: 0 });
		expect(response.status()).toBe(302);
		expect(response.headers().location).toMatch(/^\/leetcode\/login/);
		expect(response.headers()['cache-control']).toBe('private, no-store');
	});
}

test.describe('blocked notebook link', () => {
	test.beforeEach(async ({ page, notebook }) => {
		await page.route(`**/attempts/${notebook.attempt.id}`, route => route.request().method() === 'PUT' ? route.abort() : route.continue());
		await page.getByLabel('Key idea', { exact: true }).fill('Unsaved explanation');
		await expect(page.getByRole('button', { name: 'Retry save' })).toBeVisible();
		page.once('dialog', dialog => dialog.accept());
		await page.reload();
		await expect(page.getByRole('region', { name: 'Recovery copy' })).toBeVisible();
	});

	test('leaves a blocked notebook when the discard is accepted', async ({ page, notebook }) => {
		const question = new Promise<string>(resolve => page.once('dialog', dialog => { resolve(dialog.message()); void dialog.accept(); }));
		await page.getByRole('link', { name: 'Problems', exact: true }).click();
		expect(await question).toBe('Discard unsaved work and leave this page?');
		await expect(page.getByRole('heading', { name: 'Problems', exact: true })).toBeVisible();
		expect(await page.evaluate(id => sessionStorage.getItem(`leetcode:draft:student-test:${id}`), notebook.problem.id)).toBeNull();
	});

	test('stays on a blocked notebook when the discard is dismissed', async ({ page }) => {
		const question = new Promise<string>(resolve => page.once('dialog', dialog => { resolve(dialog.message()); void dialog.dismiss(); }));
		await page.getByRole('link', { name: 'Problems', exact: true }).click();
		expect(await question).toBe('Discard unsaved work and leave this page?');
		await page.getByRole('button', { name: 'Restore unsaved work' }).click();
		await expect(page.getByLabel('Key idea', { exact: true })).toHaveValue('Unsaved explanation');
	});
});
