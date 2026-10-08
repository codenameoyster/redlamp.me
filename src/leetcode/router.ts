import type { Env } from '../index';
import { NOTEBOOK_PAGE } from '../../shared/leetcode';
import { renderShell } from './shell';
import { handleSession, readSession } from './auth';
import { HttpError, methods } from './http';
import { handleProblems } from './problems';
import { handleAttempts } from './attempts';
import { handleHomework } from './homework';
import { handleLessons } from './lessons';
import { handleReviews } from './reviews';
import { handleSets } from './sets';

export function isNotebookPath(path: string): boolean {
	return path === '/leetcode' || path === '/leetcode.html' || path.startsWith('/leetcode/');
}

async function route(request: Request, env: Env, path: string): Promise<Response> {
	const url = new URL(request.url);
	if (path.startsWith('/leetcode/assets/')) return env.ASSETS.fetch(request);
	const read = ['GET', 'HEAD'].includes(request.method);
	if (url.hostname === 'www.redlamp.me') {
		if (!read) throw new HttpError(403, 'forbidden', 'Use redlamp.me for the notebook.');
		url.hostname = 'redlamp.me';
		return new Response(null, { status: 302, headers: { Location: url.href } });
	}
	if (!read && request.headers.get('origin') !== url.origin) throw new HttpError(403, 'forbidden', 'Use the notebook page to send changes.');
	if (path === '/leetcode/api/session') return handleSession(request, env);
	if (path === '/leetcode/login') { methods(request, ['GET', 'HEAD']); return renderShell(url.origin); }
	const user = await readSession(request, env);
	if (path.startsWith('/leetcode/api/')) {
		if (!user) throw new HttpError(401, 'unauthorized', 'Sign in to continue.');
		const response = await handleProblems(request, env) ?? await handleAttempts(request, env, user) ?? await handleHomework(request, env, user) ?? await handleLessons(request, env, user) ?? await handleReviews(request, env, user) ?? await handleSets(request, env);
		if (response) return response;
		throw new HttpError(404, 'not_found', 'This notebook request does not exist.');
	}
	methods(request, ['GET', 'HEAD']);
	const canonical = path.replace(/\.html$/, '').replace(/\/index$/, '').replace(/\/$/, '');
	if (!user) return new Response(null, { status: 302, headers: { Location: `/leetcode/login?return=${encodeURIComponent(canonical + url.search)}` } });
	if (!NOTEBOOK_PAGE.test(canonical)) throw new HttpError(404, 'not_found', 'This notebook page does not exist.');
	if (canonical !== path) return new Response(null, { status: 302, headers: { Location: canonical + url.search } });
	return renderShell(url.origin, user);
}

export async function handleNotebook(request: Request, env: Env, path: string): Promise<Response> {
	let response: Response;
	try { response = await route(request, env, path); }
	catch (error) {
		if (!(error instanceof HttpError)) console.error('Notebook request failed.', { type: error instanceof Error ? error.name : 'unknown', requestId: request.headers.get('cf-ray') });
		const failure = error instanceof HttpError ? error : new HttpError(503, 'unavailable', 'The notebook is unavailable. Keep your work and try again.');
		response = Response.json({ error: { code: failure.code, message: failure.status === 405 ? 'This method is not available.' : failure.message, fields: failure.fields } }, { status: failure.status, headers: failure.status === 405 ? { Allow: failure.message } : {} });
	}
	if (path.startsWith('/leetcode/assets/')) return response;
	response.headers.set('Cache-Control', 'private, no-store');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Robots-Tag', 'noindex, nofollow');
	response.headers.set('Referrer-Policy', 'no-referrer');
	return request.method === 'HEAD' ? new Response(null, response) : response;
}
