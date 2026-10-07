export function renderShell(origin: string): Response {
	return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>LeetCode notebook | redlamp</title><link rel="stylesheet" href="/leetcode/assets/style.css">
<script type="module" src="/leetcode/assets/main.js"></script></head>
<body><div id="root"></div><noscript>Enable JavaScript to use the notebook.</noscript></body></html>`, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-src ${origin}/leetcode/api/lessons/; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
		},
	});
}
