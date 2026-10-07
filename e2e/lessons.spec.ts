import { test, expect, signIn } from './fixtures';
import type { Lesson } from '../shared/leetcode';

const html = `<!doctype html><html lang="en"><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src * data: blob: 'unsafe-inline'; script-src * 'unsafe-inline'">
<button id="step">Next step</button><output id="count">0</output>
<output id="parent-check"></output><output id="storage-check"></output><output id="api-check"></output><output id="policy-check"></output>
<form action="/leetcode/api/session" method="post"><button>Send form</button></form>
<script>
let count = 0;
document.querySelector('#step').onclick = () => { document.querySelector('#count').textContent = String(++count); };
try { void parent.document.body; document.querySelector('#parent-check').textContent = 'allowed'; } catch { document.querySelector('#parent-check').textContent = 'blocked'; }
try { localStorage.setItem('probe','value'); document.querySelector('#storage-check').textContent = 'allowed'; } catch { document.querySelector('#storage-check').textContent = 'blocked'; }
fetch('/leetcode/api/session',{credentials:'include'}).then(() => document.querySelector('#api-check').textContent='allowed').catch(() => document.querySelector('#api-check').textContent='blocked');
document.addEventListener('securitypolicyviolation', event => { if (event.blockedURI === 'https://example.invalid/lesson.js') document.querySelector('#policy-check').textContent = 'Blocked by content policy'; });
const script = document.createElement('script'); script.src='https://example.invalid/lesson.js'; document.head.append(script);
</script></html>`;

let lessonId: string;
test.beforeEach(async ({ page, baseURL }) => {
	await signIn(page, 'parent');
	const response = await page.request.post('/leetcode/api/lessons', { headers: { Origin: new URL(baseURL!).origin }, multipart: { file: { name: 'lesson.html', mimeType: 'text/html', buffer: Buffer.from(html) }, metadata: JSON.stringify({ title: 'Counting lesson' }) } });
	expect(response.status()).toBe(201);
	lessonId = (await response.json() as Lesson).id;
});

const inlineChecks = [
	{ name: 'inline lesson cannot read the notebook page', output: '#parent-check', text: 'blocked' },
	{ name: 'inline lesson cannot use browser storage', output: '#storage-check', text: 'blocked' },
	{ name: 'inline lesson cannot call the notebook API', output: '#api-check', text: 'blocked' },
	{ name: 'inline lesson reports the content policy violation', output: '#policy-check', text: 'Blocked by content policy' },
];
for (const row of inlineChecks) {
	test(row.name, async ({ page }) => {
		await page.goto(`/leetcode/lessons/${lessonId}`);
		await expect(page.frameLocator('iframe').locator(row.output)).toHaveText(row.text);
	});
}

const fullPageChecks = [
	{ name: 'full-page lesson cannot use browser storage', output: '#storage-check' },
	{ name: 'full-page lesson cannot call the notebook API', output: '#api-check' },
];
for (const row of fullPageChecks) {
	test(row.name, async ({ page }) => {
		await page.goto(`/leetcode/lessons/${lessonId}`);
		await page.goto((await page.getByRole('link', { name: 'Full-page display' }).getAttribute('href'))!);
		await expect(page.locator(row.output)).toHaveText('blocked');
	});
}

test('runs the inline lesson script and blocks its form', async ({ page }) => {
	const writes: string[] = [];
	page.on('request', req => { if (req.url().includes('/api/session') && req.method() === 'POST') writes.push(req.url()); });
	await page.goto(`/leetcode/lessons/${lessonId}`);
	const frame = page.frameLocator('iframe');
	await frame.getByRole('button', { name: 'Next step' }).click();
	await expect(frame.locator('#count')).toHaveText('1');
	await frame.getByRole('button', { name: 'Send form' }).click();
	await frame.getByRole('button', { name: 'Next step' }).click();
	await expect(frame.locator('#count')).toHaveText('2');
	expect(writes).toEqual([]);
});

test('shows a lesson to the student without archive controls', async ({ page }) => {
	await signIn(page);
	await page.goto(`/leetcode/lessons/${lessonId}`);
	await expect(page.frameLocator('iframe').getByRole('button', { name: 'Next step' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Archive lesson' })).toHaveCount(0);
});
