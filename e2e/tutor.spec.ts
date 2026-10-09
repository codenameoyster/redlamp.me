import { test, expect, signIn, addMessages, addTask, type TestEnv } from './fixtures';
import type { Page, Route } from '@playwright/test';
import type { D1Database } from '@cloudflare/workers-types';
import type { Problem, TutorEvent } from '../shared/leetcode';

const setPath = '/leetcode/sets/permutations-and-combinations';
const sse = (...events: TutorEvent[]) => events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('');
const fence = (diagram: object) => `\`\`\`diagram\n${JSON.stringify(diagram)}\n\`\`\``;
const answer = [
	'Here is the search tree.',
	fence({ type: 'tree', title: 'Choose 2 of [1,2,3]', root: { label: '[]', hl: true, children: [{ label: '[1]', hl: true, children: [{ label: '[1,2]', kind: 'answer' }, { label: '[1,3]', kind: 'answer' }] }, { label: '[2]', children: [{ label: '[2,3]', kind: 'answer' }] }, { label: '[3]', kind: 'pruned', note: 'too few' }] } }),
	fence({ type: 'array', cells: [2, 7, 11, 15], pointers: { i: 0, j: 3 }, hl: [0, 3] }),
	fence({ type: 'grid', cells: [[1, 0], [0, 1]], rows: ['r0', 'r1'], cols: ['c0', 'c1'], hl: [[1, 1]] }),
	'<img src=x onerror=alert(1)>',
].join('\n\n');
// The POST goes to this handler. The GET goes to the Worker.
const onSend = (page: Page, handler: (route: Route) => Promise<void>) => page.route(url => url.pathname === '/leetcode/api/tutor/messages', route => route.request().method() === 'POST' ? handler(route) : route.fallback());
const messages = (page: Page) => page.getByRole('dialog', { name: 'AI tutor' }).getByRole('list', { name: 'Messages' }).locator(':scope > li');

async function addProblem(page: Page, baseURL: string) {
	const response = await page.request.post('/leetcode/api/problems', { headers: { Origin: new URL(baseURL).origin }, data: { url: 'https://leetcode.com/problems/two-sum/', number: 1, title: 'Two Sum', difficulty: 'easy', topics: ['Arrays'], summary: 'Find two values with the target sum.' } });
	expect(response.status()).toBe(201);
	return (await response.json() as Problem).id;
}
async function addLesson(DB: D1Database) {
	const id = crypto.randomUUID();
	await DB.batch([
		DB.prepare("INSERT INTO lessons (id,title,description,topics,filename,byte_count,created_at,updated_at) VALUES (?,'Window invariant',?,'[]','window.html',20,'now','now')").bind(id, 'Move the window.\n'.repeat(40)),
		DB.prepare("INSERT INTO lesson_content (lesson_id,html) VALUES (?,'<p>Window</p>')").bind(id),
	]);
	return id;
}

test('streams an answer, then shows the stored turn', async ({ page, notebook, server }) => {
	const { DB } = await server.getWorker<TestEnv>().getEnv();
	let body: unknown, sent = false, release!: () => void;
	const held = new Promise<void>(resolve => { release = resolve; });
	await page.route(url => url.pathname === '/leetcode/api/tutor/messages', async route => {
		if (route.request().method() !== 'POST') { if (sent) await held; return route.fallback(); }
		body = route.request().postDataJSON(); sent = true;
		await addMessages(DB, 'problem', notebook.problem.id, [{ author: 'student', body: 'Where do I start?' }, { author: 'assistant', body: 'Look at the smallest input.' }]);
		await route.fulfill({ contentType: 'text/event-stream', body: sse({ delta: 'Look at the ' }, { delta: 'smallest input.' }, { done: true }) });
	});
	const trigger = page.getByRole('button', { name: 'Ask AI', exact: true });
	await expect(trigger).toHaveAttribute('aria-expanded', 'false');
	await trigger.click();
	const panel = page.getByRole('dialog', { name: 'AI tutor' }), input = panel.getByRole('textbox', { name: 'Message' });
	await expect(trigger).toHaveAttribute('aria-expanded', 'true');
	await expect(input).toBeFocused();
	await expect(panel.getByText('Ask about this page. The tutor gives hints, not full solutions.', { exact: true })).toBeVisible();
	await expect(panel.getByText('Using ChatGPT plan. Your parent can read this chat.', { exact: true })).toBeVisible();
	await input.fill('Where do I start?');
	await panel.getByRole('button', { name: 'Send', exact: true }).click();
	await expect(panel.locator('[aria-busy="true"]')).toContainText('Look at the smallest input.');
	await expect(panel.getByRole('status')).toHaveText('The tutor is writing.');
	release();
	await expect(messages(page)).toHaveCount(2);
	await expect(messages(page).nth(0)).toContainText('You');
	await expect(messages(page).nth(0)).toContainText('Where do I start?');
	await expect(messages(page).nth(1)).toContainText('Tutor');
	await expect(messages(page).nth(1)).toContainText('Look at the smallest input.');
	await expect(panel.locator('[aria-busy]')).toHaveCount(0);
	await expect(panel.getByRole('status')).toHaveText('The tutor answered.');
	await expect(input).toHaveValue('');
	await expect(input).toBeFocused();
	expect(body).toEqual({ kind: 'problem', id: notebook.problem.id, message: 'Where do I start?', quote: null });
});

const flushes = [
	{ name: 'saves the draft before a send', saveStatus: 0, idea: 'Use a hash map.', draftErrors: 0 },
	{ name: 'sends when the draft save fails', saveStatus: 500, idea: '', draftErrors: 1 },
];
for (const row of flushes) {
	test(row.name, async ({ page, notebook, server }) => {
		const { DB } = await server.getWorker<TestEnv>().getEnv();
		let idea: string | undefined;
		if (row.saveStatus) await page.route(`**/attempts/${notebook.attempt.id}`, route => route.request().method() === 'PUT' ? route.fulfill({ status: row.saveStatus }) : route.fallback());
		await onSend(page, async route => {
			idea = JSON.parse((await DB.prepare('SELECT document FROM attempts WHERE id=?').bind(notebook.attempt.id).first<{ document: string }>())!.document).approaches[0].idea;
			await route.fulfill({ contentType: 'text/event-stream', body: sse({ done: true }) });
		});
		await page.getByLabel('Key idea', { exact: true }).fill('Use a hash map.');
		await page.getByRole('button', { name: 'Ask AI', exact: true }).click();
		const panel = page.getByRole('dialog', { name: 'AI tutor' });
		await panel.getByRole('textbox', { name: 'Message' }).fill('Is this idea correct?');
		await panel.getByRole('textbox', { name: 'Message' }).press('Control+Enter');
		await expect(panel.getByRole('status')).toHaveText('The tutor answered.');
		expect(idea).toBe(row.idea);
		await expect(page.getByRole('alert').filter({ hasText: 'Request failed. Try again.' })).toHaveCount(row.draftErrors);
	});
}

test('shows each part of the answer as it arrives', async ({ page, notebook }) => {
	await page.addInitScript(() => {
		const fetch = window.fetch, encoder = new TextEncoder();
		let stream!: ReadableStreamDefaultController<Uint8Array>;
		const body = new ReadableStream<Uint8Array>({ start(controller) { stream = controller; } });
		Object.assign(window, {
			send: (text: string) => stream.enqueue(encoder.encode(text)),
			fetch: (input: RequestInfo | URL, init?: RequestInit) => input === '/leetcode/api/tutor/messages' && init?.method === 'POST' ? Promise.resolve(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })) : fetch(input, init),
		});
	});
	await page.goto(`/leetcode/problems/${notebook.problem.id}`);
	const send = (text: string) => page.evaluate(text => (window as unknown as { send(text: string): void }).send(text), text);
	await page.getByRole('button', { name: 'Ask AI', exact: true }).click();
	const panel = page.getByRole('dialog', { name: 'AI tutor' }), busy = panel.locator('[aria-busy="true"]');
	await panel.getByRole('textbox', { name: 'Message' }).fill('Where do I start?');
	await panel.getByRole('button', { name: 'Send', exact: true }).click();
	// The second read ends inside a frame and inside a diagram fence.
	await send(sse({ delta: 'Look at the ' }) + 'data: {"del');
	await expect(busy).toContainText('Look at the');
	await send(`ta":${JSON.stringify('smallest input.\n\n```diagram\n{"type":')}}\n\n`);
	await expect(busy).toContainText('Look at the smallest input.');
	await expect(busy).toContainText('Drawing a diagram...');
	await send(sse({ done: true }));
	await expect(panel.getByRole('status')).toHaveText('The tutor answered.');
});

test('draws three diagrams and keeps HTML as text', async ({ page, notebook, server }) => {
	const { DB } = await server.getWorker<TestEnv>().getEnv(), alerts: string[] = [];
	await page.addInitScript(() => { Object.assign(window, { violations: 0 }); document.addEventListener('securitypolicyviolation', () => { Object.assign(window, { violations: (window as unknown as { violations: number }).violations + 1 }); }); });
	page.on('dialog', dialog => { alerts.push(dialog.message()); void dialog.dismiss(); });
	await page.reload();
	await onSend(page, async route => {
		await addMessages(DB, 'problem', notebook.problem.id, [{ author: 'student', body: 'Draw it.' }, { author: 'assistant', body: answer }]);
		await route.fulfill({ contentType: 'text/event-stream', body: sse(...answer.match(/[\s\S]{1,40}/g)!.map(delta => ({ delta })), { done: true }) });
	});
	await page.getByRole('button', { name: 'Ask AI', exact: true }).click();
	const panel = page.getByRole('dialog', { name: 'AI tutor' });
	await panel.getByRole('textbox', { name: 'Message' }).fill('Draw it.');
	await panel.getByRole('button', { name: 'Send', exact: true }).click();
	await expect(panel.getByRole('status')).toHaveText('The tutor answered.');
	await expect(panel.locator('figure svg')).toHaveCount(3);
	await expect(panel.getByRole('img', { name: /^Tree with 7 nodes\./ })).toBeVisible();
	await expect(panel.locator('.answer img')).toHaveCount(0);
	await expect(panel.getByText('<img src=x onerror=alert(1)>', { exact: true })).toBeVisible();
	expect(await page.evaluate(() => (window as unknown as { violations: number }).violations)).toBe(0);
	expect(alerts).toEqual([]);
});

const failures = [
	{ name: 'keeps the text after an error event', status: 200, contentType: 'text/event-stream', body: sse({ delta: 'Look' }, { error: { code: 'ai_usage_limit', message: 'The ChatGPT plan has no AI usage left now. Try again later.' } }), alert: 'The ChatGPT plan has no AI usage left now. Try again later.' },
	{ name: 'keeps the text after a JSON error before the stream', status: 409, contentType: 'application/json', body: JSON.stringify({ error: { code: 'ai_disconnected', message: 'The AI tutor is not connected. Ask your parent to connect ChatGPT.' } }), alert: 'The AI tutor is not connected. Ask your parent to connect ChatGPT.' },
	{ name: 'keeps the text after a stream that ends with no done event', status: 200, contentType: 'text/event-stream', body: sse({ delta: 'Look' }), alert: 'The answer stopped. Send your message again.' },
];
for (const row of failures) {
	test(row.name, async ({ page, notebook }) => {
		await onSend(page, route => route.fulfill({ status: row.status, contentType: row.contentType, body: row.body }));
		await page.getByRole('button', { name: 'Ask AI', exact: true }).click();
		const panel = page.getByRole('dialog', { name: 'AI tutor' }), input = panel.getByRole('textbox', { name: 'Message' });
		await expect(panel.getByText(notebook.problem.title, { exact: true })).toBeVisible();
		await input.fill('Where do I start?');
		await panel.getByRole('button', { name: 'Send', exact: true }).click();
		await expect(panel.getByRole('alert')).toHaveText(row.alert);
		await expect(input).toHaveValue('Where do I start?');
		await expect(panel.locator('[aria-busy]')).toHaveCount(0);
		await expect(panel.getByRole('status')).toHaveText('');
	});
}

const escapes = [
	{ name: 'Escape closes the docked panel and returns focus to the trigger', width: 1440, modal: false },
	{ name: 'Escape closes the modal panel and returns focus to the trigger', width: 1024, modal: true },
];
for (const row of escapes) {
	test(row.name, async ({ page }) => {
		await page.setViewportSize({ width: row.width, height: 900 });
		await signIn(page);
		await page.goto(setPath);
		const trigger = page.getByRole('button', { name: 'Ask AI', exact: true }), panel = page.getByRole('dialog', { name: 'AI tutor' });
		await trigger.click();
		await expect(panel.getByRole('textbox', { name: 'Message' })).toBeFocused();
		expect(await panel.evaluate(element => element.matches(':modal'))).toBe(row.modal);
		await page.keyboard.press('Escape');
		await expect(panel).toBeHidden();
		await expect(trigger).toBeFocused();
		await expect(trigger).toHaveAttribute('aria-expanded', 'false');
	});
}

test('docks the panel beside the lesson at desktop width and keeps it open after a reload', async ({ page, server }) => {
	const { DB } = await server.getWorker<TestEnv>().getEnv(), id = await addLesson(DB);
	await signIn(page);
	await page.goto(`/leetcode/lessons/${id}`);
	await page.getByRole('button', { name: 'Ask AI', exact: true }).click();
	const panel = page.getByRole('dialog', { name: 'AI tutor' });
	await expect(panel).toBeVisible();
	await expect(page.locator('.app')).toHaveCSS('margin-right', '420px');
	expect(await panel.boundingBox()).toEqual({ x: 1020, y: 0, width: 420, height: 1000 });
	await page.mouse.move(600, 300);
	await page.mouse.wheel(0, 400);
	await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
	await page.reload();
	await expect(panel).toBeVisible();
	await expect(page.getByRole('button', { name: 'Ask AI', exact: true })).toHaveAttribute('aria-expanded', 'true');
	await page.keyboard.press('Tab');
	await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
});

test('closes the docked panel when the window becomes narrower', async ({ page }) => {
	await signIn(page);
	await page.goto(setPath);
	const trigger = page.getByRole('button', { name: 'Ask AI', exact: true }), panel = page.getByRole('dialog', { name: 'AI tutor' });
	await trigger.click();
	await expect(panel).toBeVisible();
	await page.setViewportSize({ width: 1024, height: 1000 });
	await expect(panel).toBeHidden();
	await expect(trigger).toHaveAttribute('aria-expanded', 'false');
	await expect(page.locator('.app')).toHaveCSS('margin-right', '0px');
});

test('loads older messages above the newest page', async ({ page, notebook, server }) => {
	const { DB } = await server.getWorker<TestEnv>().getEnv();
	await addMessages(DB, 'problem', notebook.problem.id, Array.from({ length: 51 }, (_, i) => ({ author: 'student' as const, body: `Message ${i + 1}` })));
	await page.getByRole('button', { name: 'Ask AI', exact: true }).click();
	const older = page.getByRole('dialog', { name: 'AI tutor' }).getByRole('button', { name: 'Older messages', exact: true });
	await expect(messages(page)).toHaveCount(50);
	await expect(messages(page).first().locator('p')).toHaveText('Message 2');
	await older.click();
	await expect(messages(page)).toHaveCount(51);
	await expect(messages(page).first().locator('p')).toHaveText('Message 1');
	await expect(messages(page).last().locator('p')).toHaveText('Message 51');
	await expect(older).toHaveCount(0);
});

test('opens the chat of the problem on the task page', async ({ page, notebook, server }) => {
	const { DB } = await server.getWorker<TestEnv>().getEnv(), { taskId } = await addTask(DB, notebook.problem.id);
	await addMessages(DB, 'problem', notebook.problem.id, [{ author: 'student', body: 'Where do I start?' }, { author: 'assistant', body: 'Look at the smallest input.' }]);
	await page.goto(`/leetcode/tasks/${taskId}`);
	await page.getByRole('button', { name: 'Ask AI', exact: true }).click();
	await expect(messages(page)).toHaveCount(2);
	await expect(messages(page).nth(1)).toContainText('Look at the smallest input.');
});

test('shows the chat read-only to the parent', async ({ page, server, baseURL }) => {
	const { DB } = await server.getWorker<TestEnv>().getEnv();
	await signIn(page, 'parent');
	const id = await addProblem(page, baseURL!);
	await addMessages(DB, 'problem', id, [{ author: 'student', body: 'Why does this fail?', quote: 'Return the indices.' }, { author: 'assistant', body: 'Check the **second** index.' }]);
	await page.goto(`/leetcode/problems/${id}`);
	await page.getByRole('button', { name: 'Read AI chat', exact: true }).click();
	const panel = page.getByRole('dialog', { name: 'AI tutor' });
	await expect(panel.getByRole('heading', { name: 'AI tutor' })).toBeFocused();
	await expect(panel.getByText('The chat of the student. Read only.', { exact: true })).toBeVisible();
	await expect(messages(page)).toHaveCount(2);
	await expect(messages(page).nth(0)).toContainText('Student');
	await expect(messages(page).nth(0).locator('blockquote')).toHaveText('Return the indices.');
	await expect(messages(page).nth(1).locator('strong')).toHaveText('second');
	await expect(panel.getByRole('textbox', { name: 'Message' })).toHaveCount(0);
	await expect(panel.getByRole('button', { name: 'Send' })).toHaveCount(0);
});

test('lists the chats for the parent and opens one in the panel', async ({ page, server, baseURL }) => {
	const { DB } = await server.getWorker<TestEnv>().getEnv();
	await signIn(page, 'parent');
	const id = await addProblem(page, baseURL!);
	await addMessages(DB, 'set', 'permutations-and-combinations', [{ author: 'student', body: 'What is a pruned branch?' }], '2026-10-08T10:00:00.000Z');
	await addMessages(DB, 'problem', id, [{ author: 'student', body: 'Where do I start?' }, { author: 'assistant', body: 'Look at the smallest input.' }]);
	await page.getByRole('link', { name: 'AI tutor', exact: true }).click();
	const rows = page.getByRole('region', { name: 'Chats' }).getByRole('article');
	await expect(rows).toHaveCount(2);
	await expect(rows.nth(0)).toContainText(/Two Sum.*Problem.*2 messages/);
	await expect(rows.nth(1)).toContainText(/Permutations and combinations.*Set.*1 message/);
	await expect(rows.nth(1).getByRole('link')).toHaveAttribute('href', `${setPath}#tutor`);
	await rows.nth(0).getByRole('link', { name: 'Two Sum', exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/leetcode/problems/${id}#tutor$`));
	await expect(messages(page).nth(1)).toContainText('Look at the smallest input.');
	await expect(page.getByRole('button', { name: 'Read AI chat', exact: true })).toHaveAttribute('aria-expanded', 'true');
});

const placements = [
	{ name: 'shows Read AI chat to the parent on the task page', role: 'parent', path: async (DB: D1Database, problemId: string) => `/leetcode/tasks/${(await addTask(DB, problemId)).taskId}`, heading: 'Two Sum', button: 'Read AI chat', count: 1 },
	{ name: 'shows Read AI chat to the parent on the set page', role: 'parent', path: async () => setPath, heading: 'Permutations and combinations', button: 'Read AI chat', count: 1 },
	{ name: 'shows Read AI chat to the parent on the lesson page', role: 'parent', path: async (DB: D1Database) => `/leetcode/lessons/${await addLesson(DB)}`, heading: 'Window invariant', button: 'Read AI chat', count: 1 },
	{ name: 'shows no AI button on Today', role: 'student', path: async () => '/leetcode', heading: 'Build understanding, one problem at a time.', button: /^(Ask AI|Read AI chat)$/, count: 0 },
	{ name: 'shows no AI button on the problem list', role: 'student', path: async () => '/leetcode/problems', heading: 'Problems', button: /^(Ask AI|Read AI chat)$/, count: 0 },
	{ name: 'shows no AI button on the recall page', role: 'student', path: async (_DB: D1Database, problemId: string) => `/leetcode/problems/${problemId}/review`, heading: 'Two Sum', button: /^(Ask AI|Read AI chat)$/, count: 0 },
] as const;
for (const row of placements) {
	test(row.name, async ({ page, notebook, server }) => {
		const { DB } = await server.getWorker<TestEnv>().getEnv(), path = await row.path(DB, notebook.problem.id);
		if (row.role === 'parent') await signIn(page, 'parent');
		await page.goto(path);
		await expect(page.getByRole('heading', { level: 1, name: row.heading, exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: row.button, exact: true })).toHaveCount(row.count);
	});
}

test('tells the student that the tutor page is for the parent', async ({ page }) => {
	await signIn(page);
	await page.goto('/leetcode/tutor');
	await expect(page.getByText('This page is for the parent.', { exact: true })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Chats' })).toHaveCount(0);
});

test('shows the address error under the address field', async ({ page }) => {
	await signIn(page, 'parent');
	await page.route('**/leetcode/api/tutor/account/start', route => route.fulfill({ json: { url: 'https://auth.openai.com/oauth/authorize?state=test' } }));
	await page.route('**/leetcode/api/tutor/account/finish', route => route.fulfill({ status: 400, json: { error: { code: 'invalid_address', message: 'Paste the full address that starts with http://127.0.0.1:47319/auth/callback.' } } }));
	await page.goto('/leetcode/tutor');
	await page.getByRole('button', { name: 'Continue with ChatGPT', exact: true }).click();
	const field = page.getByLabel('Address from the error page');
	await field.fill('http://127.0.0.1:1455/auth/callback?code=test');
	await page.getByRole('button', { name: 'Connect', exact: true }).click();
	const alert = page.getByRole('alert');
	await expect(alert).toHaveText('Paste the full address that starts with http://127.0.0.1:47319/auth/callback.');
	expect((await alert.boundingBox())!.y).toBeGreaterThan((await field.boundingBox())!.y);
});

const stepper = 'Select a mode. Then push Step. The tree marks the current call. The code marks the current line. Each circle is one call of backtrack. The number in a circle is the value that the call added to path. Sections 4 to 7 use this stepper too.';
const marked = 'The passage is marked in the lesson.', notFound = 'This passage is not in the lesson text.';
const lesson = (page: Page) => page.frameLocator('iframe.lesson-frame');
const highlight = (page: Page) => page.getByRole('status', { name: 'Lesson highlight' });
const explains = [
	{ name: 'explains a mouse selection with the frame button', select: async (page: Page) => {
		const box = (await lesson(page).locator('p', { hasText: 'Each circle is one call of' }).boundingBox())!;
		await page.mouse.move(box.x + 1, box.y + 4);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width - 1, box.y + box.height - 4, { steps: 5 });
		await page.mouse.up();
		await lesson(page).getByRole('button', { name: 'Explain with AI', exact: true }).click();
	} },
	{ name: 'explains a selection with Ctrl+Enter', select: async (page: Page) => {
		const paragraph = lesson(page).locator('p', { hasText: 'Each circle is one call of' });
		await paragraph.click(); // The key goes to the focused frame.
		await paragraph.selectText();
		await expect(lesson(page).getByRole('button', { name: 'Explain with AI', exact: true })).toBeVisible(); // The bridge reads the selection in a later task.
		await page.keyboard.press('Control+Enter');
	} },
	{ name: 'sends one request for a burst of lesson posts', select: (page: Page) => lesson(page).locator('body').evaluate((_, text) => { for (let i = 0; i < 3; i++) parent.postMessage({ type: 'explain', text }, '*'); }, stepper) },
];
for (const row of explains) {
	test(row.name, async ({ page, server }) => {
		const { DB } = await server.getWorker<TestEnv>().getEnv();
		const bodies: { quote: string }[] = [];
		await signIn(page);
		await onSend(page, async route => {
			const body = route.request().postDataJSON() as { quote: string };
			bodies.push(body);
			await addMessages(DB, 'set', 'permutations-and-combinations', [{ author: 'student', body: 'Explain this part.', quote: body.quote }, { author: 'assistant', body: 'Each call adds one value.' }]);
			await route.fulfill({ contentType: 'text/event-stream', body: sse({ done: true }) });
		});
		await page.goto(setPath);
		await lesson(page).locator('p', { hasText: 'Each circle is one call of' }).scrollIntoViewIfNeeded();
		await row.select(page);
		const panel = page.getByRole('dialog', { name: 'AI tutor' });
		await expect(panel).toBeVisible();
		await expect(panel.getByRole('status')).toHaveText('The tutor answered.');
		await expect(messages(page).nth(0).locator('blockquote')).toHaveText(stepper);
		expect(bodies).toEqual([{ kind: 'set', id: 'permutations-and-combinations', message: 'Explain this part.', quote: stepper }]);
		await expect(lesson(page).getByRole('button', { name: 'Explain with AI' })).toHaveCount(0);
	});
}

test('shows no lesson bridge to the parent', async ({ page, server }) => {
	const { DB } = await server.getWorker<TestEnv>().getEnv();
	await addMessages(DB, 'set', 'permutations-and-combinations', [{ author: 'student', body: 'What is a circle?' }, { author: 'assistant', body: '```lesson\nEach circle is one call of backtrack.\n```' }]);
	await signIn(page, 'parent');
	await page.goto(setPath);
	await page.getByRole('button', { name: 'Read AI chat', exact: true }).click();
	await expect(messages(page).nth(1).locator('blockquote')).toHaveText('Each circle is one call of backtrack.');
	await expect(page.getByRole('button', { name: 'Show in the lesson' })).toHaveCount(0);
	await lesson(page).locator('p', { hasText: 'Each circle is one call of' }).selectText();
	await expect.poll(() => lesson(page).locator('html').evaluate(() => document.readyState)).toBe('complete');
	await expect(lesson(page).locator('lesson-ai')).toHaveCount(0);
});

test('shows no lesson bridge in the full-page display', async ({ page }) => {
	await signIn(page);
	const response = await page.goto('/leetcode/api/sets/permutations-and-combinations/lesson');
	expect(await response!.text()).toContain("document.createElement('lesson-ai')");
	await page.locator('p', { hasText: 'Each circle is one call of' }).selectText();
	await expect(page.locator('lesson-ai')).toHaveCount(0);
});

const highlights = [
	{ name: 'marks a quote with other whitespace and case', from: 'notebook', quotes: ['each circle is   one\ncall of backtrack.'], marks: ['Each circle is one call of', 'backtrack', '.'], status: marked },
	{ name: 'marks the longest quote prefix after a drift', from: 'notebook', quotes: ['The tree marks the current call and then …'], marks: ['The tree marks the current call'], status: marked },
	{ name: 'does not mark hidden lesson text', from: 'notebook', quotes: ['After the first answer, all items stay marked as used.'], marks: [], status: notFound },
	{ name: 'tells that a quote is not in the lesson', from: 'notebook', quotes: ['A heap keeps the smallest item at the root.'], marks: [], status: notFound },
	{ name: 'removes the marks of the first quote', from: 'notebook', quotes: ['Each circle is one call of backtrack.', 'The number in a circle is the value'], marks: ['The number in a circle is the value'], status: marked },
	{ name: 'ignores a highlight that the lesson posts', from: 'lesson', quotes: ['Each circle is one call of backtrack.'], marks: [], status: '' },
] as const;
for (const row of highlights) {
	test(row.name, async ({ page }) => {
		await signIn(page);
		await page.goto(setPath);
		await expect(lesson(page).locator('lesson-ai')).toHaveCount(1);
		for (const quote of row.quotes) {
			if (row.from === 'notebook') await page.evaluate(quote => document.querySelector<HTMLIFrameElement>('iframe.lesson-frame')!.contentWindow!.postMessage({ type: 'highlight', quote }, '*'), quote);
			// The bridge listener runs before this one, so the bridge has handled the message when the promise resolves.
			else await lesson(page).locator('body').evaluate((_, quote) => new Promise(resolve => { addEventListener('message', resolve, { once: true }); postMessage({ type: 'highlight', quote }, '*'); }), quote);
		}
		await expect(highlight(page)).toHaveText(row.status);
		await expect(lesson(page).locator('mark')).toHaveText([...row.marks]);
	});
}

const shows = [
	{ name: 'marks the lesson passage from the docked panel', width: 1440, panelOpen: true },
	{ name: 'closes the modal panel before it marks the lesson passage', width: 1024, panelOpen: false },
];
for (const row of shows) {
	test(row.name, async ({ page, server }) => {
		const { DB } = await server.getWorker<TestEnv>().getEnv();
		await addMessages(DB, 'set', 'permutations-and-combinations', [{ author: 'student', body: 'What is a circle?' }, { author: 'assistant', body: 'Read this part:\n\n```lesson\nEach circle is one call of backtrack.\n```' }]);
		await page.setViewportSize({ width: row.width, height: 900 });
		await signIn(page);
		await page.goto(setPath);
		await page.getByRole('button', { name: 'Ask AI', exact: true }).click();
		const panel = page.getByRole('dialog', { name: 'AI tutor' });
		await panel.getByRole('button', { name: 'Show in the lesson', exact: true }).click();
		await expect(highlight(page)).toHaveText(marked);
		await expect(lesson(page).locator('mark')).toHaveText(['Each circle is one call of', 'backtrack', '.']);
		await expect(lesson(page).locator('mark').first()).toBeInViewport();
		await expect(panel).toBeVisible({ visible: row.panelOpen });
	});
}
