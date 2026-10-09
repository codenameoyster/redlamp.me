import { waitUntil } from 'cloudflare:workers';
import type { Env } from '../index';
import type { SessionUser, TutorAccount } from '../../shared/leetcode';
import { requireRole } from './auth';
import { choice, HttpError, methods, object, readJson, text } from './http';

// Sign in with ChatGPT: https://developers.openai.com/siwc/token-sharing-open-source/sign-in
const AUTH = 'https://auth.openai.com/api/accounts';
const API = 'https://api.openai.com/v1';
const REDIRECT_URI = 'http://127.0.0.1:47319/auth/callback'; // Only the port may change between sign-ins. No listener: the browser shows an error page with the address.
const SCOPE = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const AGENT_NAME = 'redlamp notebook';
const TERMINAL = ['invalid_grant', 'invalid_refresh_token', 'token_expired', 'refresh_token_expired', 'refresh_token_invalidated', 'refresh_token_reused'];
const CLEAR = 'access_token=NULL,refresh_token=NULL,expires_at=NULL,refresh_after=NULL,refreshing_until=NULL,version=version+1';

interface AccountRow {
	host_id: string; client_id: string | null; model: string | null; models: string | null; access_token: string | null; refresh_token: string | null;
	expires_at: number | null; refresh_after: number | null; refreshing_until: number | null; pending_state: string | null; pending_verifier: string | null; pending_expires_at: number | null;
	version: number; connected_at: string | null;
}
type TokenBody = Partial<{ access_token: string; refresh_token: string; token_type: string; expires_in: number; scope: string; earliest_refresh_at: string | number; error: string }>;
export interface Token { access: string; version: number; model: string }

const disconnected = () => new HttpError(409, 'ai_disconnected', 'The AI tutor is not connected. Ask your parent to connect ChatGPT.');
const unavailable = () => new HttpError(503, 'ai_unavailable', 'ChatGPT is not available now. Try again in a few minutes.');
const notEligible = () => new HttpError(403, 'ai_not_eligible', 'This ChatGPT account does not allow plan use for this app.');
const signInFailed = () => new HttpError(400, 'sign_in_failed', 'ChatGPT sign-in failed. Start again.');
const readAccount = (env: Env) => env.DB.prepare('SELECT * FROM tutor_account WHERE id=1').first<AccountRow>();
const bytes = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));
const base64 = (value: Uint8Array) => btoa(String.fromCharCode(...value));
const base64url = (value: Uint8Array) => base64(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = () => base64url(crypto.getRandomValues(new Uint8Array(32)));

async function key(env: Env): Promise<CryptoKey> {
	try {
		const raw = bytes(env.TUTOR_TOKEN_KEY ?? '');
		if (raw.length === 32) return await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
	} catch { /* Not base64. */ }
	throw new HttpError(503, 'setup_required', 'The AI tutor needs configuration.');
}
async function seal(secret: CryptoKey, value: string): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	return base64(new Uint8Array([...iv, ...new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, secret, new TextEncoder().encode(value)))]));
}
async function unseal(secret: CryptoKey, value: string): Promise<string> {
	const raw = bytes(value);
	return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.subarray(0, 12) }, secret, raw.subarray(12)));
}

async function tokenRequest(form: Record<string, string>): Promise<{ status: number; body: TokenBody }> {
	try {
		const response = await fetch(`${AUTH}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams(form), signal: AbortSignal.timeout(20_000) });
		return { status: response.status, body: await response.json<TokenBody>().catch(() => ({})) };
	} catch { return { status: 0, body: {} }; }
}
function validTokens(body: TokenBody): body is Required<Pick<TokenBody, 'access_token' | 'refresh_token' | 'expires_in'>> & TokenBody {
	return typeof body.access_token === 'string' && typeof body.refresh_token === 'string' && /^bearer$/i.test(String(body.token_type)) && typeof body.expires_in === 'number' && body.expires_in > 0;
}
// earliest_refresh_at is an ISO date or Unix seconds.
function refreshAfter(value: unknown): number | null {
	const time = typeof value === 'number' ? value * 1000 : typeof value === 'string' ? Date.parse(value) : NaN;
	return Number.isFinite(time) ? time : null;
}

// Returns a usable access token. Refreshes at most once across all isolates: the lease is a compare-and-swap on version and refreshing_until.
export async function accessToken(env: Env, stale?: number): Promise<Token> {
	const secret = await key(env);
	for (let i = 0; i < 20; i++) {
		const now = Date.now(), row = await readAccount(env);
		if (!row?.refresh_token) throw disconnected();
		const early = now < (row.refresh_after ?? 0);
		if (row.version !== stale && row.expires_at! > now && (row.expires_at! > now + 300_000 || early)) {
			try { return { access: await unseal(secret, row.access_token!), version: row.version, model: row.model! }; } catch { throw disconnected(); }
		}
		if (early) throw unavailable(); // Expired, and OpenAI does not allow a refresh yet.
		const lease = await env.DB.prepare('UPDATE tutor_account SET refreshing_until=? WHERE id=1 AND version=? AND coalesce(refreshing_until,0)<?').bind(now + 30_000, row.version, now).run();
		if (lease.meta.changes) { const job = refresh(env, secret, row); waitUntil(job.catch(() => {})); return job; }
		await scheduler.wait(500);
	}
	throw unavailable();
}

// The rotation must reach D1 also when the caller disconnects: the old refresh token is single use.
async function refresh(env: Env, secret: CryptoKey, row: AccountRow): Promise<Token> {
	const release = env.DB.prepare('UPDATE tutor_account SET refreshing_until=NULL WHERE id=1 AND version=?').bind(row.version);
	let current: string;
	try { current = await unseal(secret, row.refresh_token!); } catch { await release.run(); throw disconnected(); } // A key change keeps the ciphertext: the old key can come back.
	const { status, body } = await tokenRequest({ grant_type: 'refresh_token', client_id: row.client_id!, refresh_token: current, resource: API });
	const now = Date.now();
	if (status === 200 && validTokens(body)) {
		await env.DB.prepare('UPDATE tutor_account SET access_token=?,refresh_token=?,expires_at=?,refresh_after=?,refreshing_until=NULL,version=version+1,updated_at=? WHERE id=1 AND version=?')
			.bind(await seal(secret, body.access_token), await seal(secret, body.refresh_token), now + body.expires_in * 1000, refreshAfter(body.earliest_refresh_at), new Date(now).toISOString(), row.version).run();
		return { access: body.access_token, version: row.version + 1, model: row.model! };
	}
	if (TERMINAL.includes(String(body.error))) {
		await env.DB.prepare(`UPDATE tutor_account SET ${CLEAR},updated_at=? WHERE id=1 AND version=?`).bind(new Date(now).toISOString(), row.version).run();
		throw disconnected();
	}
	await release.run();
	throw unavailable();
}

async function account(env: Env): Promise<TutorAccount> {
	const row = await readAccount(env), connected = Boolean(row?.refresh_token);
	return { connected, connectedAt: connected ? row!.connected_at : null, model: row?.model ?? null, models: JSON.parse(row?.models ?? '[]'), pending: (row?.pending_expires_at ?? 0) > Date.now() };
}

async function start(env: Env): Promise<Response> {
	await key(env);
	const state = random(), verifier = random();
	const row = await env.DB.prepare('INSERT INTO tutor_account (id,host_id,pending_state,pending_verifier,pending_expires_at,updated_at) VALUES (1,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET pending_state=excluded.pending_state,pending_verifier=excluded.pending_verifier,pending_expires_at=excluded.pending_expires_at,updated_at=excluded.updated_at RETURNING host_id,client_id')
		.bind(`urn:uuid:${crypto.randomUUID()}`, state, verifier, Date.now() + 600_000, new Date().toISOString()).first<Pick<AccountRow, 'host_id' | 'client_id'>>();
	const params = new URLSearchParams({
		client_id: row!.client_id ?? 'dynamic_agent_client', ...(row!.client_id ? {} : { agent_name_hint: AGENT_NAME }), ext_agent_host_id: row!.host_id, response_type: 'code', redirect_uri: REDIRECT_URI,
		scope: SCOPE, resource: API, state, nonce: random(), code_challenge_method: 'S256', code_challenge: base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))),
	});
	return Response.json({ url: `${AUTH}/authorize?${params}` });
}

async function finish(request: Request, env: Env): Promise<Response> {
	const address = text(object(await readJson(request), ['address']).address, 4000);
	const secret = await key(env);
	const callback = URL.parse(address);
	if (!callback || callback.origin + callback.pathname !== REDIRECT_URI) throw new HttpError(400, 'invalid_address', 'Paste the full address that starts with http://127.0.0.1:47319/auth/callback.');
	const params = callback.searchParams, states = params.getAll('state'), row = await readAccount(env);
	if (!row?.pending_state || row.pending_expires_at! <= Date.now() || states.length !== 1 || states[0] !== row.pending_state) throw new HttpError(400, 'sign_in_expired', 'This sign-in is out of date. Start again.');
	const clear = env.DB.prepare('UPDATE tutor_account SET client_id=?,pending_state=NULL,pending_verifier=NULL,pending_expires_at=NULL WHERE id=1');
	if (params.has('error')) { await clear.bind(row.client_id).run(); throw new HttpError(400, 'not_approved', 'ChatGPT access was not approved.'); }
	const ids = params.getAll('client_id'), codes = params.getAll('code');
	if (row.client_id ? ids.some(id => id !== row.client_id) : ids.length !== 1 || !/^[A-Za-z0-9_-]{1,200}$/.test(ids[0]) || ids[0] === 'dynamic_agent_client') throw signInFailed();
	const clientId = row.client_id ?? ids[0];
	await clear.bind(clientId).run(); // Store the issued client ID before the exchange, so a retry does not register a second app. The code is single use.
	if (codes.length !== 1) throw signInFailed();
	const { status, body } = await tokenRequest({ grant_type: 'authorization_code', client_id: clientId, code: codes[0], code_verifier: row.pending_verifier!, redirect_uri: REDIRECT_URI, resource: API });
	if (!status || status >= 500) throw unavailable();
	if (status !== 200 || !validTokens(body)) throw signInFailed();
	if (!String(body.scope).split(' ').includes('chatgpt.tokens.use.direct')) throw notEligible();
	const response = await fetch(`${API}/models`, { headers: { Authorization: `Bearer ${body.access_token}` }, signal: AbortSignal.timeout(20_000) }).catch(() => null);
	if (!response || response.status >= 500) throw unavailable();
	const listing = await response.json<{ models?: { slug?: unknown; display_name?: unknown; visibility?: unknown }[] }>().catch(() => ({ models: [] }));
	const models = (response.ok && Array.isArray(listing.models) ? listing.models : []).filter(m => m.visibility === 'list' && typeof m.slug === 'string').map(m => ({ slug: String(m.slug), name: String(m.display_name ?? m.slug) }));
	if (!models.length) throw notEligible();
	const now = Date.now(), iso = new Date(now).toISOString();
	await env.DB.prepare('UPDATE tutor_account SET model=?,models=?,access_token=?,refresh_token=?,expires_at=?,refresh_after=?,refreshing_until=NULL,version=version+1,connected_at=?,updated_at=? WHERE id=1')
		.bind(models.some(m => m.slug === row.model) ? row.model : models[0].slug, JSON.stringify(models), await seal(secret, body.access_token), await seal(secret, body.refresh_token), now + body.expires_in * 1000, refreshAfter(body.earliest_refresh_at), iso, iso).run();
	return Response.json(await account(env));
}

async function disconnect(env: Env): Promise<Response> {
	const row = await readAccount(env);
	let revoked = !row?.refresh_token;
	if (!revoked) {
		try {
			const response = await fetch(`${AUTH}/oauth/revoke`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: await unseal(await key(env), row!.refresh_token!), token_type_hint: 'refresh_token', client_id: row!.client_id! }), signal: AbortSignal.timeout(10_000) });
			revoked = response.status === 200;
		} catch { /* The parent removes the app in ChatGPT settings. */ }
	}
	await env.DB.prepare(`UPDATE tutor_account SET ${CLEAR},pending_state=NULL,pending_verifier=NULL,pending_expires_at=NULL,updated_at=? WHERE id=1`).bind(new Date().toISOString()).run();
	return Response.json({ revoked });
}

export async function handleChatgpt(request: Request, env: Env, user: SessionUser): Promise<Response | null> {
	const match = /^\/leetcode\/api\/tutor\/account(?:\/(start|finish))?$/.exec(new URL(request.url).pathname);
	if (!match) return null;
	methods(request, match[1] ? ['POST'] : ['GET', 'PATCH', 'DELETE']);
	requireRole(user, 'parent');
	if (match[1] === 'start') return start(env);
	if (match[1] === 'finish') return finish(request, env);
	if (request.method === 'DELETE') return disconnect(env);
	if (request.method === 'PATCH') {
		const data = object(await readJson(request), ['model']), row = await readAccount(env);
		if (!row?.refresh_token) throw disconnected();
		const model = choice(data.model, (JSON.parse(row.models ?? '[]') as TutorAccount['models']).map(m => m.slug));
		await env.DB.prepare('UPDATE tutor_account SET model=?,updated_at=? WHERE id=1').bind(model, new Date().toISOString()).run();
	}
	return Response.json(await account(env));
}
