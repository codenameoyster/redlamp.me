import { test, expect, signIn } from './fixtures';

const html = `<!doctype html><html lang="en"><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src * data: blob: 'unsafe-inline'; script-src * 'unsafe-inline'">
<button id="step">Next step</button><output id="count">0</output>
<output id="parent-check"></output><output id="storage-check"></output><output id="api-check"></output><output id="external-check"></output><output id="policy-check"></output>
<form action="/leetcode/api/session" method="post"><button>Send form</button></form>
<script>
let count = 0;
document.querySelector('#step').onclick = () => { document.querySelector('#count').textContent = String(++count); };
try { void parent.document.body; document.querySelector('#parent-check').textContent = 'allowed'; } catch { document.querySelector('#parent-check').textContent = 'blocked'; }
try { localStorage.setItem('probe','value'); document.querySelector('#storage-check').textContent = 'allowed'; } catch { document.querySelector('#storage-check').textContent = 'blocked'; }
fetch('/leetcode/api/session',{credentials:'include'}).then(() => document.querySelector('#api-check').textContent='allowed').catch(() => document.querySelector('#api-check').textContent='blocked');
document.addEventListener('securitypolicyviolation', event => { if (event.blockedURI === 'https://example.invalid/lesson.js') document.querySelector('#policy-check').textContent = 'Blocked by content policy'; });
const script = document.createElement('script'); script.src='https://example.invalid/lesson.js'; script.onerror=() => document.querySelector('#external-check').textContent='blocked'; document.head.append(script);
</script></html>`;

test('runs inline lessons while blocking notebook, storage, network, and forms', async ({ page }) => {
	await signIn(page, 'parent');
	await page.getByRole('link', { name: 'Lessons', exact: true }).click();
	await page.getByLabel('Title', { exact: true }).fill('Counting lesson');
	await page.getByLabel('HTML file', { exact: true }).setInputFiles({ name: 'lesson.html', mimeType: 'text/html', buffer: Buffer.from(html) });
	const writes: string[] = [];
	page.on('request', req => { if (req.url().includes('/api/session') && req.method() === 'POST') writes.push(req.url()); });
	await page.getByRole('button', { name: 'Upload and preview' }).click();
	const frame = page.frameLocator('iframe');
	await frame.getByRole('button', { name: 'Next step' }).click();
	await expect(frame.locator('#count')).toHaveText('1');
	await expect(frame.locator('#parent-check')).toHaveText('blocked');
	await expect(frame.locator('#storage-check')).toHaveText('blocked');
	await expect(frame.locator('#api-check')).toHaveText('blocked');
	await expect(frame.locator('#external-check')).toHaveText('blocked');
	await expect(frame.locator('#policy-check')).toHaveText('Blocked by content policy');
	await frame.getByRole('button', { name: 'Send form' }).click();
	await frame.getByRole('button', { name: 'Next step' }).click();
	await expect(frame.locator('#count')).toHaveText('2');
	expect(writes).toEqual([]);
	const contentURL = await page.getByRole('link', { name: 'Full-page display' }).getAttribute('href');
	const lessonURL = page.url();
	await page.goto(contentURL!);
	await expect(page.locator('#storage-check')).toHaveText('blocked');
	await expect(page.locator('#api-check')).toHaveText('blocked');
	await signIn(page);
	await page.goto(lessonURL);
	await expect(page.frameLocator('iframe').getByRole('button', { name: 'Next step' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Archive lesson' })).toHaveCount(0);
});
