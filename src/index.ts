export interface Env {
	ASSETS: Fetcher;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		// Serve static assets
		return env.ASSETS.fetch(request);
	},
};