import type { SessionUser } from '../../shared/leetcode';

// The code editor adds <style> elements with this nonce. Each response gets a new random nonce of 128 bits: https://www.w3.org/TR/CSP3/#security-nonces
export function renderShell(user?: SessionUser): Response {
	const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
	return new Response(`<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Тетрадь LeetCode | redlamp</title><link rel="icon" href="/leetcode/assets/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="/leetcode/assets/style.css"><meta name="csp-nonce" nonce="${nonce}">
${user ? `<script id="session" type="application/json">${JSON.stringify(user)}</script>` : ''}<script type="module" src="/leetcode/assets/main.js"></script></head>
<body><div id="root"></div><noscript>Включите JavaScript, чтобы пользоваться тетрадью.</noscript></body></html>`, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self' 'nonce-${nonce}'; connect-src 'self'; media-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
		},
	});
}
