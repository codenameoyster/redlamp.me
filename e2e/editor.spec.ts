import type { Locator, Page } from '@playwright/test';
import { test, expect, signIn, type TestEnv } from './fixtures';

// The editor draws each line of the code in its own element, and toHaveText ignores the spaces at the start of a line.
const lines = (code: Locator) => code.locator('.cm-line').allTextContents();

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

test('marks the attempt solved and keeps the work in a new copy', async ({ page, notebook }) => {
	await page.getByLabel('Основная идея', { exact: true }).fill('Original explanation');
	await page.getByRole('button', { name: 'Решено', exact: true }).click();
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
	const { id, problemId, version, document } = notebook.attempt;
	const value = { document: { ...document, approaches: [{ ...document.approaches[0], idea: 'Recovered explanation' }] } };
	await page.evaluate(recovery => sessionStorage.setItem(`leetcode:draft:parent-test:${recovery.problemId}`, JSON.stringify(recovery.copy)), { problemId, copy: { attemptId: id, baseVersion: version, value, editedAt: new Date().toISOString() } });
	await signIn(page, 'parent');
	await page.goto(`/leetcode/problems/${notebook.problem.id}`);
	await expect(page.getByLabel('Основная идея', { exact: true })).toHaveAttribute('readonly', '');
	await expect(page.getByRole('button', { name: 'Решено', exact: true })).toHaveCount(0);
	await expect(page.getByRole('region', { name: 'Копия для восстановления' })).toHaveCount(0);
});

test('keeps unsaved work while problem metadata refreshes', async ({ page, notebook }) => {
	await page.route(`**/attempts/${notebook.attempt.id}`, route => route.request().method() === 'PUT' ? route.abort() : route.continue());
	await page.getByLabel('Основная идея', { exact: true }).fill('Keep the current reasoning');
	await page.getByRole('button', { name: 'Повторить сохранение' }).click();
	await page.getByRole('button', { name: 'Изменить задачу', exact: true }).click();
	await page.getByLabel('Название', { exact: true }).fill('Updated metadata');
	await page.getByRole('button', { name: 'Сохранить задачу', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Updated metadata', level: 1 })).toBeVisible();
	await expect(page.getByLabel('Основная идея', { exact: true })).toHaveValue('Keep the current reasoning');
});

test('protects older recovery when another tab starts a replacement draft', async ({ page, context, notebook }) => {
	const second = await context.newPage();
	await second.goto(`/leetcode/problems/${notebook.problem.id}`);
	await second.getByLabel('Основная идея', { exact: true }).fill('The saved server explanation');
	await second.getByRole('button', { name: 'Решено', exact: true }).click();
	await expect(second.getByText('Попытка сохранена.', { exact: true })).toBeVisible();
	await page.getByLabel('Основная идея', { exact: true }).fill('Keep the older unsaved explanation');
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('На сервере другая копия');
	page.once('dialog', dialog => dialog.accept());
	await page.reload();
	await expect(page.getByRole('region', { name: 'Копия для восстановления' })).toContainText('Keep the older unsaved explanation');
	await expect(page.getByLabel('Основная идея', { exact: true })).toBeDisabled();
	await expect(page.getByLabel('Код решения', { exact: true })).not.toBeEditable();
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
	await second.getByRole('button', { name: 'Решено', exact: true }).click();
	await expect(second.getByText('Попытка сохранена.', { exact: true })).toBeVisible();
	await page.getByLabel('Основная идея', { exact: true }).fill('Local explanation');
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('На сервере другая копия');
	page.once('dialog', dialog => dialog.accept());
	await page.getByRole('button', { name: 'Использовать копию с сервера', exact: true }).click();
	await expect(page.getByLabel('Основная идея', { exact: true })).toHaveValue('Second tab explanation');
	await expect(page.getByLabel('Основная идея', { exact: true })).toBeEditable();
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
	const attempts = await (await page.request.get(`/leetcode/api/problems/${notebook.problem.id}/attempts`)).json();
	expect(attempts.items.map((attempt: { state: string }) => attempt.state)).toEqual(['draft', 'saved']);
});

test('drops recovery when edits return to the server copy', async ({ page, notebook }) => {
	const idea = page.getByLabel('Основная идея', { exact: true });
	await idea.fill('x');
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
	await idea.fill('y'); await idea.fill('x');
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
	expect(await page.evaluate(id => sessionStorage.getItem(`leetcode:draft:student-test:${id}`), notebook.problem.id)).toBeNull();
	await page.getByRole('button', { name: 'Решено', exact: true }).click();
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
	await page.getByRole('button', { name: 'Решено', exact: true }).click();
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
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('На сервере другая копия');
	await expect(page.getByRole('button', { name: 'Скопировать несохранённую работу' })).toBeVisible();
	page.once('dialog', dialog => dialog.accept());
	await page.reload();
	await page.getByRole('button', { name: 'Восстановить несохранённую работу' }).click();
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('На сервере другая копия');
	await expect(page.getByLabel('Основная идея', { exact: true })).toHaveValue('First tab explanation');
	const server = await page.request.get(`/leetcode/api/problems/${notebook.problem.id}/attempts/${notebook.attempt.id}`);
	expect((await server.json()).document.approaches[0].idea).toBe('Second tab explanation');
});

test('numbers each line of the code at the top of its wrapped line', async ({ page, notebook }) => {
	await expect(page.getByRole('heading', { name: notebook.problem.title })).toBeVisible();
	await page.getByLabel('Код решения', { exact: true }).fill(`x = 1\n# ${'long_comment_'.repeat(300)}\n\ny = 2`);
	const numbers = page.locator('.cm-lineNumbers .cm-gutterElement').filter({ visible: true });
	await expect(numbers).toHaveText(['1', '2', '3', '4']);
	// The comment wraps, so the number of the last line moves down to the highlighted "2".
	const [first, comment, last, two] = await Promise.all([numbers.nth(0).boundingBox(), numbers.nth(1).boundingBox(), numbers.nth(3).boundingBox(), page.locator('.cm-content .tok-number').last().boundingBox()]);
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

// The formatted code follows the default style of the Ruff formatter: https://docs.astral.sh/ruff/formatter/#style-guide
// The line of a syntax error is the line of CPython 3.14 compile(), as in the list under the editor.
const formats = [
	{ name: 'formats the code with Ruff', code: 'x=1;y=[1,2 ,3]', message: '', formatted: 'x = 1\ny = [1, 2, 3]\n', keys: [], expected: 'x = 1\ny = [1, 2, 3]\n', shown: 0 },
	{ name: 'gives the old code back with Ctrl+Z after the format', code: 'x=1;y=[1,2 ,3]', message: '', formatted: 'x = 1\ny = [1, 2, 3]\n', keys: ['ControlOrMeta+Z'], expected: 'x=1;y=[1,2 ,3]', shown: 0 },
	{ name: 'undoes later typing separately from formatting', code: 'x=1', message: '', formatted: 'x = 1\n', keys: ['ControlOrMeta+End', 'a', 'ControlOrMeta+Z'], expected: 'x = 1\n', shown: 0 },
	{ name: 'undoes formatting after later typing', code: 'x=1', message: '', formatted: 'x = 1\n', keys: ['ControlOrMeta+End', 'a', 'ControlOrMeta+Z', 'ControlOrMeta+Z'], expected: 'x=1', shown: 0 },
	{ name: 'adds no undo step for code that is already formatted', code: 'x = 1\n', message: '', formatted: 'x = 1\n', keys: ['ControlOrMeta+Z'], expected: '', shown: 0 },
	{ name: 'keeps code with a syntax error and names its line', code: 'x = 1\ndef f(:\n    pass', message: 'Не удалось отформатировать: ошибка в строке 2.', formatted: 'x = 1\ndef f(:\n    pass', keys: [], expected: 'x = 1\ndef f(:\n    pass', shown: 1 },
	{ name: 'names the line of an unclosed bracket', code: 'n = int(input())\nprint(sum(range(n))\n', message: 'Не удалось отформатировать: ошибка в строке 2.', formatted: 'n = int(input())\nprint(sum(range(n))\n', keys: [], expected: 'n = int(input())\nprint(sum(range(n))\n', shown: 1 },
	{ name: 'removes the format message after a change of the code', code: 'x = 1\ndef f(:\n    pass', message: 'Не удалось отформатировать: ошибка в строке 2.', formatted: 'x = 1\ndef f(:\n    pass', keys: ['ControlOrMeta+End', 'Backspace'], expected: 'x = 1\ndef f(:\n    pas', shown: 0 },
];
for (const row of formats) {
	test(row.name, async ({ page, notebook }) => {
		await expect(page.getByRole('heading', { name: notebook.problem.title })).toBeVisible();
		const code = page.getByLabel('Код решения', { exact: true });
		await code.fill(row.code);
		await page.getByRole('button', { name: 'Форматировать', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Форматировать', exact: true })).toBeEnabled({ timeout: 30_000 });
		if (row.message) await expect(page.getByText(row.message, { exact: true })).toBeVisible({ timeout: 30_000 });
		await expect.poll(() => lines(code), { timeout: 30_000 }).toEqual(row.formatted.split('\n'));
		await code.focus();
		for (const key of row.keys) await page.keyboard.press(key);
		await expect.poll(() => lines(code)).toEqual(row.expected.split('\n'));
		await expect(page.getByText(/^Не удалось отформатировать/)).toHaveCount(row.shown);
		await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
		await page.reload();
		await expect.poll(() => lines(code)).toEqual(row.expected.split('\n'));
	});
}

// Hold the real worker's format response while other messages continue.
async function holdFormat(page: Page) {
	return page.evaluateHandle(() => {
		const gate = { held: false, release: () => {} }, NativeWorker = Worker;
		window.Worker = class extends NativeWorker {
			constructor(url: string | URL, options?: WorkerOptions) {
				super(url, options);
				const formats = new Set<number>(), post = this.postMessage.bind(this);
				this.postMessage = data => { if (data.type === 'format') formats.add(data.id); post(data); };
				this.addEventListener('message', event => {
					if (!formats.delete(event.data.id)) return;
					event.stopImmediatePropagation(); gate.held = true;
					gate.release = () => { gate.held = false; this.dispatchEvent(new MessageEvent('message', { data: event.data })); };
				});
			}
		};
		return gate;
	});
}

const delayedFormats = [
	{ name: 'keeps edits made while formatting waits', source: 'x=1', edit: 'y=2', expected: 'y=2' },
	{ name: 'discards a format error after the code changes', source: 'def f(:', edit: 'x=1', expected: 'x=1' },
	{ name: 'applies formatting after cursor movement', source: 'x=1', edit: null, expected: 'x = 1\n' },
];
for (const row of delayedFormats) {
	test(row.name, async ({ page, notebook }) => {
		await expect(page.getByRole('heading', { name: notebook.problem.title })).toBeVisible();
		const gate = await holdFormat(page), code = page.getByLabel('Код решения', { exact: true });
		await code.fill(row.source);
		await page.getByRole('button', { name: 'Форматировать', exact: true }).click();
		await expect.poll(() => gate.evaluate(gate => gate.held), { timeout: 30_000 }).toBe(true);
		if (row.edit !== null) await code.fill(row.edit);
		else { await code.focus(); await page.keyboard.press('Home'); }
		await gate.evaluate(async gate => { gate.release(); await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); });
		await expect(page.getByRole('button', { name: 'Форматировать', exact: true })).toBeEnabled();
		await expect.poll(() => lines(code)).toEqual(row.expected.split('\n'));
		await expect(page.getByText(/^Не удалось отформатировать/)).toHaveCount(0);
		await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
		await page.reload();
		await expect.poll(() => lines(code)).toEqual(row.expected.split('\n'));
	});
}

test('clears the format error and undo history when using the server copy', async ({ page, context, notebook }) => {
	const second = await context.newPage(), code = page.getByLabel('Код решения', { exact: true });
	await second.goto(`/leetcode/problems/${notebook.problem.id}`);
	await second.getByLabel('Код решения', { exact: true }).fill('x=1');
	await expect(second.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
	await code.fill('def f(:');
	await page.getByRole('button', { name: 'Форматировать', exact: true }).click();
	await expect(page.getByText('Не удалось отформатировать: ошибка в строке 1.', { exact: true })).toBeVisible({ timeout: 30_000 });
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('На сервере другая копия');
	page.once('dialog', dialog => dialog.accept());
	await page.getByRole('button', { name: 'Использовать копию с сервера', exact: true }).click();
	await expect.poll(() => lines(code)).toEqual(['x=1']);
	await expect(page.getByText(/^Не удалось отформатировать/)).toHaveCount(0);
	await code.focus();
	await page.keyboard.press('ControlOrMeta+Z');
	await expect.poll(() => lines(code)).toEqual(['x=1']);
});

for (const row of [
	{ name: 'discards formatting while the draft is locked', replaced: false, expected: 'x=1' },
	{ name: 'discards formatting after a replacement draft opens', replaced: true, expected: 'y=2' },
]) {
	test(row.name, async ({ page, notebook }) => {
		const gate = await holdFormat(page), code = page.getByLabel('Код решения', { exact: true });
		let release!: () => void, entered!: () => void;
		const held = new Promise<void>(resolve => { release = resolve; }), solving = new Promise<void>(resolve => { entered = resolve; });
		if (!row.replaced) await page.route(`**/problems/${notebook.problem.id}/solved`, async route => {
			entered(); await held; await route.fulfill({ status: 409, json: { error: { code: 'conflict', message: 'Save refused for this check.' } } });
		});
		await code.fill('x=1');
		await page.getByRole('button', { name: 'Форматировать', exact: true }).click();
		await expect.poll(() => gate.evaluate(gate => gate.held), { timeout: 30_000 }).toBe(true);
		await page.getByRole('button', { name: 'Решено', exact: true }).click();
		if (row.replaced) {
			await expect(page.getByText('Попытка сохранена.', { exact: true })).toBeVisible();
			await code.fill(row.expected);
		} else { await solving; await expect(code).not.toBeEditable(); }
		await gate.evaluate(async gate => { gate.release(); await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); });
		await expect(page.getByText('Форматируем...', { exact: true })).toHaveCount(0);
		await expect.poll(() => lines(code)).toEqual([row.expected]);
		if (!row.replaced) { release(); await expect(page.getByRole('alert')).toContainText('Save refused for this check.'); }
		await expect(code).toBeEditable();
		await expect(page.getByRole('button', { name: 'Форматировать', exact: true })).toBeEnabled();
	});
}

test('keeps formatting through a pending autosave', async ({ page, notebook }) => {
	const gate = await holdFormat(page), code = page.getByLabel('Код решения', { exact: true }), format = page.getByRole('button', { name: 'Форматировать', exact: true });
	let release!: () => void, entered!: () => void;
	const held = new Promise<void>(resolve => { release = resolve; }), saving = new Promise<void>(resolve => { entered = resolve; });
	await page.route(`**/attempts/${notebook.attempt.id}`, async route => {
		if (route.request().method() !== 'PUT') return route.continue();
		const response = await route.fetch(); entered(); await held; await route.fulfill({ response });
	}, { times: 1 });
	await code.fill('x=1');
	await saving;
	await format.click();
	await expect.poll(() => gate.evaluate(gate => gate.held), { timeout: 30_000 }).toBe(true);
	await expect(format).toBeDisabled();
	await expect(page.getByText('Форматируем...', { exact: true })).toBeVisible();
	await expect(code).toBeEditable();
	await gate.evaluate(gate => gate.release());
	await expect(format).toBeEnabled();
	await expect.poll(() => lines(code)).toEqual(['x = 1', '']);
	release();
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
	await page.reload();
	await expect.poll(() => lines(code)).toEqual(['x = 1', '']);
});

// The parent view and the review page show the code read-only. The recovery copy locks the field, and the fieldset disables the button.
const fixedCode = [
	{ name: 'shows no format button to the parent', buttons: 0, open: async (page: Page, problemId: string) => {
		await signIn(page, 'parent');
		await page.goto(`/leetcode/problems/${problemId}`);
	} },
	{ name: 'shows no format button on the review page', buttons: 0, open: async (page: Page) => {
		await page.getByLabel('Код решения', { exact: true }).fill('x=1');
		await page.getByRole('button', { name: 'Решено', exact: true }).click();
		await expect(page.getByText('Попытка сохранена.', { exact: true })).toBeVisible();
		await page.getByRole('link', { name: 'Повторить задачу' }).click();
		await page.getByRole('button', { name: 'Показать сохранённую работу' }).click();
	} },
	{ name: 'disables the format button while the field is locked', buttons: 1, open: async (page: Page) => {
		await page.route('**/attempts/*', route => route.request().method() === 'PUT' ? route.abort() : route.continue());
		await page.getByLabel('Основная идея', { exact: true }).fill('Recover this explanation');
		await expect(page.getByRole('button', { name: 'Повторить сохранение' })).toBeVisible();
		page.once('dialog', dialog => dialog.accept());
		await page.reload();
		await expect(page.getByRole('button', { name: 'Восстановить несохранённую работу' })).toBeVisible();
	} },
];
for (const row of fixedCode) {
	test(row.name, async ({ page, notebook }) => {
		await row.open(page, notebook.problem.id);
		await expect(page.getByLabel('Код решения', { exact: true })).not.toBeEditable();
		await expect(page.getByRole('button', { name: 'Форматировать', exact: true })).toHaveCount(row.buttons);
		await expect(page.getByRole('button', { name: 'Форматировать', exact: true, disabled: false })).toHaveCount(0);
	});
}

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
		await expect.poll(() => lines(code)).toEqual(row.expected.split('\n'));
		await expect(status).toHaveText('Сохранено');
		await page.reload();
		await expect.poll(() => lines(code)).toEqual(row.expected.split('\n'));
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
	await expect.poll(() => lines(page.getByLabel('Код решения', { exact: true }))).toEqual(skeleton.split('\n'));
});

// Python 3.14 raises TabError for a tab under a block with 4 spaces, so the editor indents with 4 spaces.
const keys = [
	{ name: 'inserts four spaces with Tab on an empty line', code: 'def f():\n', keys: ['Tab'], text: 'return 1', expected: 'def f():\n    return 1', leaves: false },
	{ name: 'indents every selected line with Tab', code: 'a\nb', keys: ['ControlOrMeta+A', 'Tab'], text: '', expected: '    a\n    b', leaves: false },
	{ name: 'inserts spaces up to the next stop with Tab after its text', code: 'x', keys: ['Tab'], text: 'y', expected: 'x   y', leaves: false },
	{ name: 'inserts four spaces with Tab at a stop', code: 'abcd', keys: ['Tab'], text: 'y', expected: 'abcd    y', leaves: false },
	{ name: 'replaces a selection inside one line with spaces up to the next stop', code: 'abcdef', keys: ['Home', 'ArrowRight', 'Shift+ArrowRight', 'Shift+ArrowRight', 'Tab'], text: 'Z', expected: 'a   Zdef', leaves: false },
	{ name: 'removes one level of indentation with Shift+Tab', code: '        x', keys: ['Shift+Tab'], text: '', expected: '    x', leaves: false },
	{ name: 'removes a short indentation with Shift+Tab', code: '  x', keys: ['Shift+Tab'], text: '', expected: 'x', leaves: false },
	{ name: 'keeps the focus on Shift+Tab on a line without indentation', code: 'x', keys: ['Shift+Tab'], text: '', expected: 'x', leaves: false },
	{ name: 'undoes the Tab with Ctrl+Z', code: 'x', keys: ['Tab', 'ControlOrMeta+Z'], text: '', expected: 'x', leaves: false },
	{ name: 'leaves the code field with Escape and then Tab', code: 'x', keys: ['Escape', 'Tab'], text: '', expected: 'x', leaves: true },
	{ name: 'leaves the code field with Escape and then Tab with a selection', code: 'x', keys: ['ControlOrMeta+A', 'Escape', 'Tab'], text: '', expected: 'x', leaves: true },
];
for (const row of keys) {
	test(row.name, async ({ page, notebook }) => {
		await expect(page.getByRole('heading', { name: notebook.problem.title })).toBeVisible();
		const code = page.getByLabel('Код решения', { exact: true });
		await code.fill(row.code);
		for (const key of row.keys) await page.keyboard.press(key);
		await page.keyboard.type(row.text);
		await expect.poll(() => lines(code)).toEqual(row.expected.split('\n'));
		await expect(row.leaves ? page.getByRole('button', { name: 'Скопировать код', exact: true }) : code).toBeFocused();
		await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
		await page.reload();
		await expect.poll(() => lines(code)).toEqual(row.expected.split('\n'));
	});
}

test('moves the focus out of a read-only code field with Tab', async ({ page, notebook }) => {
	const code = page.getByLabel('Код решения', { exact: true });
	await code.fill('x');
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
	await signIn(page, 'parent');
	await page.goto(`/leetcode/problems/${notebook.problem.id}`);
	await code.focus();
	await expect(code).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(page.getByRole('button', { name: 'Скопировать код', exact: true })).toBeFocused();
	await expect.poll(() => lines(code)).toEqual(['x']);
	await expect(code).not.toBeEditable();
});

test('keeps the focus on the copy button when the tests load', async ({ page, notebook }) => {
	let release!: () => void;
	const held = new Promise<void>(resolve => { release = resolve; });
	await page.route('**/leetcode/api/problems/*/tests', async route => { await held; await route.fulfill({ json: { spec: { mode: 'call', method: 'twoSum' }, source: 'set', standard: [{ input: '[[2, 7, 11, 15], 9]', expected: '[0, 1]' }], own: [], skeleton: '' } }); });
	await page.goto(`/leetcode/problems/${notebook.problem.id}`);
	const copy = page.getByRole('button', { name: 'Скопировать код', exact: true });
	await copy.focus();
	release();
	await expect(page.getByRole('button', { name: 'Запустить тесты', exact: true })).toBeVisible();
	await expect(copy).toBeFocused();
});

test('keeps the starter code when Ctrl+Z undoes more than the typed text', async ({ page, notebook }) => {
	await page.route('**/leetcode/api/problems/*/tests', route => route.fulfill({ json: { spec: null, source: 'none', standard: [], own: [], skeleton } }));
	await page.goto(`/leetcode/problems/${notebook.problem.id}`);
	const code = page.getByLabel('Код решения', { exact: true });
	await expect.poll(() => lines(code)).toEqual(skeleton.split('\n'));
	await code.focus();
	await page.keyboard.press('ControlOrMeta+End');
	await page.keyboard.type('return []');
	for (let undo = 0; undo < 3; undo++) await page.keyboard.press('ControlOrMeta+Z');
	await expect.poll(() => lines(code)).toEqual(skeleton.split('\n'));
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
	await page.reload();
	await expect.poll(() => lines(code)).toEqual(skeleton.split('\n'));
});

const solved = [
	{ name: 'refuses Решено for the untouched starter code', time: '', typed: '', result: 'Добавьте объяснение, заметки или код перед отправкой.' },
	{ name: 'refuses Решено for the starter code with only a time estimate', time: 'O(n)', typed: '', result: 'Добавьте объяснение, заметки или код перед отправкой.' },
	{ name: 'accepts Решено after an edit of the starter code', time: '', typed: 'return [0, 1]', result: 'Попытка сохранена.' },
];
for (const row of solved) {
	test(row.name, async ({ page, notebook }) => {
		await page.route('**/leetcode/api/problems/*/tests', route => route.fulfill({ json: { spec: null, source: 'none', standard: [], own: [], skeleton } }));
		await page.goto(`/leetcode/problems/${notebook.problem.id}`);
		const code = page.getByLabel('Код решения', { exact: true });
		await expect.poll(() => lines(code)).toEqual(skeleton.split('\n'));
		await page.getByLabel('Время', { exact: true }).fill(row.time);
		await code.focus();
		await page.keyboard.press('ControlOrMeta+End');
		await page.keyboard.type(row.typed);
		await page.getByRole('button', { name: 'Решено', exact: true }).click();
		await expect(page.getByText(row.result)).toBeVisible();
	});
}

test('describes the keys of the code field', async ({ page, notebook }) => {
	await expect(page.getByRole('heading', { name: notebook.problem.title })).toBeVisible();
	await expect(page.getByLabel('Код решения', { exact: true })).toHaveAccessibleDescription(/^Tab или Enter при открытом списке: вставить выбранное имя\. .*Esc и сразу Tab: выйти из поля\.$/);
});

const names = (page: Page, name?: string) => page.getByRole('listbox', { name: 'Подсказки' }).getByRole('option', { name, exact: true });
// The expected names come from the Python 3.14 docs: https://docs.python.org/3.14/reference/lexical_analysis.html#keywords, https://docs.python.org/3.14/builtins/functions.html#print, https://docs.python.org/3.14/library/heapq.html, https://docs.python.org/3.14/library/collections.html#collections.deque, https://docs.python.org/3.14/library/stdtypes.html#mutable-sequence-types
const completions = [
	{ name: 'offers a built-in function', code: '', typed: 'pr', option: 'print' },
	{ name: 'offers a name of the code', code: 'total = 0\n', typed: 'to', option: 'total' },
	{ name: 'offers a module of the prelude', code: '', typed: 'hea', option: 'heapq' },
	{ name: 'offers a keyword', code: 'def f():\n    ', typed: 'ret', option: 'return' },
	{ name: 'offers a function of a module after a dot', code: '', typed: 'heapq.heap', option: 'heappush' },
	{ name: 'offers a method of a deque after a dot', code: 'q = collections.deque()\n', typed: 'q.pop', option: 'popleft' },
	{ name: 'offers a method of a parameter of the starter code after a dot', code: skeleton, typed: 'nums.app', option: 'append' },
];
for (const row of completions) {
	test(row.name, async ({ page, notebook }) => {
		test.slow();
		await expect(page.getByRole('heading', { name: notebook.problem.title })).toBeVisible();
		await page.getByLabel('Код решения', { exact: true }).fill(row.code);
		await page.keyboard.type(row.typed);
		await expect(names(page, row.option)).toBeVisible({ timeout: 30_000 });
	});
}

// The letters of `next` come after the list opens, and the key follows them at once.
const accepts = [
	{ name: 'inserts the selected name with Tab', typed: 'pri', option: 'print', next: '', key: 'Tab', expected: ['print'] },
	{ name: 'inserts the selected name with Enter', typed: 'pri', option: 'print', next: '', key: 'Enter', expected: ['print'] },
	{ name: 'inserts the selected member with Enter', typed: 'heapq.heappu', option: 'heappush', next: '', key: 'Enter', expected: ['heapq.heappush'] },
	{ name: 'starts a new line with Enter after a name typed in full', typed: 'pass', option: 'pass', next: '', key: 'Enter', expected: ['pass', ''] },
	{ name: 'inserts the selected name with Tab right after a typed letter', typed: 'pr', option: 'print', next: 'i', key: 'Tab', expected: ['print'] },
	{ name: 'inserts the selected member with Enter right after a typed letter', typed: 'heapq.heapp', option: 'heappop', next: 'u', key: 'Enter', expected: ['heapq.heappush'] },
];
for (const row of accepts) {
	test(row.name, async ({ page, notebook }) => {
		test.slow();
		await expect(page.getByRole('heading', { name: notebook.problem.title })).toBeVisible();
		const code = page.getByLabel('Код решения', { exact: true });
		await code.fill('');
		await page.keyboard.type(row.typed);
		await expect(names(page).first()).toHaveText(row.option, { timeout: 30_000 });
		// A key in the first 75 ms after the list opens does not take a name: https://codemirror.net/docs/ref/#autocomplete.autocompletion^config.interactionDelay
		await page.waitForTimeout(100);
		await page.keyboard.type(row.next);
		await page.keyboard.press(row.key);
		await expect.poll(() => lines(code)).toEqual(row.expected);
		await expect(names(page)).toHaveCount(0);
	});
}

// jedi sets the recursion limit to 3000 when it loads, and the tests run with the default limit 1000: https://docs.python.org/3.14/library/sys.html#sys.setrecursionlimit
test('keeps the recursion limit of the tests after a member completion', async ({ page, notebook }) => {
	test.slow();
	await page.route('**/leetcode/api/problems/*/tests', route => route.fulfill({ json: { spec: { mode: 'stdio' }, source: 'set', standard: [{ input: '1500', expected: '1500' }], own: [] } }));
	await page.goto(`/leetcode/problems/${notebook.problem.id}`);
	const code = page.getByLabel('Код решения', { exact: true });
	await code.fill('');
	await page.keyboard.type('heapq.');
	await expect(names(page, 'heappush')).toBeVisible({ timeout: 30_000 });
	await page.keyboard.press('Escape');
	await code.fill('def depth(n):\n    return 0 if n == 0 else 1 + depth(n - 1)\nprint(depth(int(input())))\n');
	await page.getByRole('button', { name: 'Запустить тесты', exact: true }).click();
	await expect(page.getByRole('list', { name: 'Результаты тестов' }).getByRole('listitem')).toHaveText(['Тест 1: ✗ Ввод: 1500 Верный ответ: 1500 Строка 2: RecursionError: maximum recursion depth exceeded'], { useInnerText: true, timeout: 30_000 });
});

test('closes the list and leaves the code field with Escape and then Tab', async ({ page, notebook }) => {
	test.slow();
	await expect(page.getByRole('heading', { name: notebook.problem.title })).toBeVisible();
	const code = page.getByLabel('Код решения', { exact: true });
	await code.fill('');
	await page.keyboard.type('pri');
	await expect(names(page).first()).toHaveText('print', { timeout: 30_000 });
	await page.keyboard.press('Escape');
	await page.keyboard.press('Tab');
	await expect(page.getByRole('button', { name: 'Скопировать код', exact: true })).toBeFocused();
	await expect(names(page)).toHaveCount(0);
	await expect.poll(() => lines(code)).toEqual(['pri']);
});

test('shows the list of names under the page CSP', async ({ page, notebook }) => {
	test.slow();
	await page.addInitScript(() => { Object.assign(window, { violations: 0 }); document.addEventListener('securitypolicyviolation', () => { Object.assign(window, { violations: (window as unknown as { violations: number }).violations + 1 }); }); });
	await page.reload();
	await expect(page.getByRole('heading', { name: notebook.problem.title })).toBeVisible();
	await page.getByLabel('Код решения', { exact: true }).fill('');
	await page.keyboard.type('heapq.heappo');
	await expect(names(page).first()).toHaveText('heappop', { timeout: 30_000 });
	expect(await page.evaluate(() => (window as unknown as { violations: number }).violations)).toBe(0);
});

test('offers no names in a read-only code field', async ({ page, notebook }) => {
	const code = page.getByLabel('Код решения', { exact: true });
	await code.fill('total = 0\nto');
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
	await signIn(page, 'parent');
	await page.goto(`/leetcode/problems/${notebook.problem.id}`);
	await code.focus();
	await page.keyboard.press('ControlOrMeta+End');
	await page.keyboard.press('Control+Space');
	// A field with completion gets aria-autocomplete at its first transaction: https://www.w3.org/TR/wai-aria-1.2/#aria-autocomplete
	await expect(code).not.toHaveAttribute('aria-autocomplete');
	await expect(names(page)).toHaveCount(0);
});

test('keeps the typing during a test run and shows no error when the run stops the completion', async ({ page, notebook }) => {
	test.slow();
	await page.route('**/leetcode/api/problems/*/tests', route => route.fulfill({ json: { spec: { mode: 'stdio' }, source: 'set', standard: [{ input: '1', expected: '1' }], own: [] } }));
	await page.goto(`/leetcode/problems/${notebook.problem.id}`);
	const code = page.getByLabel('Код решения', { exact: true }), run = page.getByRole('button', { name: 'Запустить тесты', exact: true });
	await code.fill('while True:\n    pass\n');
	await run.click();
	await code.focus();
	await page.keyboard.press('ControlOrMeta+End');
	await page.keyboard.type('heapq.heap');
	await expect.poll(() => lines(code)).toEqual(['while True:', '    pass', 'heapq.heap']);
	await expect(run).toBeDisabled();
	await expect(page.getByRole('list', { name: 'Результаты тестов' }).getByRole('listitem')).toHaveText(['Тест 1: ✗ Ввод: 1 Верный ответ: 1 Превышено время (2 с)'], { useInnerText: true, timeout: 30_000 });
	await expect(page.getByRole('alert')).toHaveCount(0);
	// The completion waits behind the endless run, and the stop of the worker drops it. A completion between the check and the run of a test shows the list and uses the time of the test.
	await expect(names(page)).toHaveCount(0);
	await page.keyboard.type('p');
	await expect(names(page).first()).toHaveText('heappop', { timeout: 30_000 });
});
