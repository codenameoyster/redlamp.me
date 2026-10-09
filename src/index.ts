import { handleNotebook, isNotebookPath } from './leetcode/router';

export interface Env {
	ASSETS: Fetcher;
	DB: D1Database;
	LOGIN_LIMITER: RateLimit;
	LEETCODE_ACCOUNTS: string;
	LEETCODE_LOCAL_HTTP?: string;
	TUTOR_TOKEN_KEY?: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		let path: string;
		try { path = decodeURIComponent(new URL(request.url).pathname); }
		catch { return new Response('Invalid URL.', { status: 400 }); }
		if (isNotebookPath(path)) return handleNotebook(request, env, path);
		return env.ASSETS.fetch(request);
	},
};
