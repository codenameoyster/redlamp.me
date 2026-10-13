import type { Locator, Page } from '@playwright/test';
import { test, expect, signIn } from './fixtures';
import type { Attempt } from '../shared/leetcode';

// The microphone is a tone from an AudioContext, so the test needs no audio device and no system permission.
async function microphone(page: Page, allowed = true) {
	await page.evaluate(allowed => {
		navigator.mediaDevices.getUserMedia = async () => {
			if (!allowed) throw new DOMException('Permission denied', 'NotAllowedError');
			const context = new AudioContext(), tone = context.createOscillator(), output = context.createMediaStreamDestination();
			tone.connect(output);
			tone.start();
			return output.stream;
		};
	}, allowed);
}
const mic = (field: Locator) => field.locator('..').getByRole('button', { name: 'Голосовой ввод' });
async function dictate(page: Page, field: Locator) {
	await microphone(page);
	const button = mic(field);
	await button.click();
	await expect(button).toHaveAttribute('aria-pressed', 'true');
	await expect(button).toContainText('0:01');
	await button.click();
}

const rows = [
	{ name: 'fills an empty field', value: '', cursor: [0, 0], result: 'Два указателя.' },
	{ name: 'adds a space after a word', value: 'Идея', cursor: [4, 4], result: 'Идея Два указателя.' },
	{ name: 'adds a space before a word', value: 'конец', cursor: [0, 0], result: 'Два указателя. конец' },
	{ name: 'adds no space next to a space', value: 'Идея конец', cursor: [5, 5], result: 'Идея Два указателя. конец' },
	{ name: 'replaces the selected text', value: 'Идея старое конец', cursor: [5, 11], result: 'Идея Два указателя. конец' },
];
for (const row of rows) {
	test(`dictation ${row.name}`, async ({ page, notebook }) => {
		let sent: { audio?: string } = {};
		await page.route('**/leetcode/api/dictation', route => { sent = route.request().postDataJSON(); return route.fulfill({ json: { text: 'Два указателя.' } }); });
		const field = page.getByLabel('Основная идея', { exact: true });
		await field.fill(row.value);
		await field.evaluate((element: HTMLTextAreaElement, [start, end]) => element.setSelectionRange(start, end), row.cursor);
		await dictate(page, field);
		await expect(field).toHaveValue(row.result);
		await expect(field).toBeFocused();
		// A WebM file starts with the EBML magic bytes 1A 45 DF A3.
		expect(sent.audio).toMatch(/^GkXfo/);
		// The saved draft has the text, so React got it too.
		await expect.poll(async () => (await (await page.request.get(`/leetcode/api/problems/${notebook.problem.id}/attempts/${notebook.attempt.id}`)).json() as Attempt).document.approaches[0].idea, { timeout: 10_000 }).toBe(row.result);
	});
}

// React mounts a textarea with its saved text and the cursor at 0. The student did not put the cursor there, so the text goes at the end.
test('dictation adds to saved text after a reload', async ({ page, notebook }) => {
	void notebook;
	await page.route('**/leetcode/api/dictation', route => route.fulfill({ json: { text: 'Два указателя.' } }));
	const field = page.getByLabel('Основная идея', { exact: true });
	await field.fill('Идея');
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
	await page.reload();
	await dictate(page, field);
	await expect(field).toHaveValue('Идея Два указателя.');
});

const fields: { name: string; open: (page: Page, problemId: string) => Promise<Locator> }[] = [
	{ name: 'the tutor message', open: async page => { await page.getByRole('button', { name: 'Спросить ИИ', exact: true }).click(); return page.getByRole('dialog', { name: 'ИИ-репетитор' }).getByLabel('Сообщение', { exact: true }); } },
	{ name: 'the review note', open: async (page, problemId) => { await page.goto(`/leetcode/problems/${problemId}/review`); return page.getByLabel('Заметка', { exact: true }); } },
	{ name: 'the problem description', open: async page => { await page.goto('/leetcode/problems'); await page.getByRole('button', { name: 'Добавить задачу', exact: true }).click(); return page.getByLabel('Описание', { exact: true }); } },
];
for (const row of fields) {
	test(`dictation fills ${row.name}`, async ({ page, notebook }) => {
		await page.route('**/leetcode/api/dictation', route => route.fulfill({ json: { text: 'Два указателя.' } }));
		const field = await row.open(page, notebook.problem.id);
		await dictate(page, field);
		await expect(field).toHaveValue('Два указателя.');
	});
}

const failures = [
	{ name: 'silence', reply: { json: { text: '' } }, deny: false, alert: 'Речь не распознана. Попробуйте ещё раз.' },
	{ name: 'a failed transcription', reply: { status: 503, json: { error: { code: 'dictation_unavailable', message: 'Распознавание речи сейчас недоступно. Попробуйте позже.' } } }, deny: false, alert: 'Распознавание речи сейчас недоступно. Попробуйте позже.' },
	{ name: 'a blocked microphone', reply: { json: { text: 'Два указателя.' } }, deny: true, alert: 'Разрешите доступ к микрофону.' },
];
for (const row of failures) {
	test(`dictation reports ${row.name}`, async ({ page, notebook }) => {
		void notebook;
		await page.route('**/leetcode/api/dictation', route => route.fulfill(row.reply));
		await microphone(page, !row.deny);
		const field = page.getByLabel('Основная идея', { exact: true }), button = mic(field);
		await button.click();
		if (!row.deny) { await expect(button).toContainText('0:01'); await button.click(); }
		await expect(field.locator('..').getByRole('alert')).toHaveText(row.alert);
		await expect(field).toHaveValue('');
		await expect(button).toBeEnabled();
	});
}

test('the parent sees no dictation button in the problem form', async ({ page, browser, baseURL, notebook }) => {
	await expect(mic(page.getByLabel('Основная идея', { exact: true }))).toBeVisible();
	void notebook;
	const context = await browser.newContext({ baseURL }), parent = await context.newPage();
	try {
		await signIn(parent, 'parent');
		await parent.goto('/leetcode/problems');
		await parent.getByRole('button', { name: 'Добавить задачу', exact: true }).click();
		await expect(parent.getByLabel('Описание', { exact: true })).toBeVisible();
		await expect(parent.getByRole('button', { name: 'Голосовой ввод' })).toHaveCount(0);
	} finally { await context.close(); }
});
