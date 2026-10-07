import { handleNotebook, isNotebookPath } from './leetcode/router';

export interface Env {
	ASSETS: Fetcher;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		let path: string;
		try { path = decodeURIComponent(new URL(request.url).pathname); }
		catch { return new Response('Invalid URL.', { status: 400 }); }
		if (isNotebookPath(path)) return handleNotebook(request, env);
		return env.ASSETS.fetch(request);
	},
};
