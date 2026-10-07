import type { Env } from '../index';
import { renderShell } from './shell';

export function isNotebookPath(path: string): boolean {
	return path === '/leetcode' || path === '/leetcode.html' || path.startsWith('/leetcode/');
}

export async function handleNotebook(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const path = decodeURIComponent(url.pathname);
	if (path.startsWith('/leetcode/assets/')) return env.ASSETS.fetch(request);
	let response: Response;
	if (path === '/leetcode/login') response = renderShell(url.origin);
	else if (path.startsWith('/leetcode/api/')) {
		response = Response.json({ error: { code: 'unauthorized', message: 'Sign in to continue.' } }, { status: 401 });
	} else {
		response = new Response(null, { status: 302, headers: { Location: `/leetcode/login?return=${encodeURIComponent(path)}` } });
	}
	response.headers.set('Cache-Control', 'private, no-store');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Robots-Tag', 'noindex, nofollow');
	return response;
}
