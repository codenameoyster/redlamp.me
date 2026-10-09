import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { accessToken } from '../src/leetcode/chatgpt';
import type { HttpError } from '../src/leetcode/http';
import { login, request } from './client';

const AUTHORIZE = 'https://auth.openai.com/api/accounts/authorize', TOKEN = 'https://auth.openai.com/api/accounts/oauth/token', REVOKE = 'https://auth.openai.com/api/accounts/oauth/revoke', MODELS = 'https://api.openai.com/v1/models';
const CALLBACK = 'http://127.0.0.1:47319/auth/callback', RESOURCE = 'https://api.openai.com/v1', HOST = 'urn:uuid:8d9f2a4e-6b1c-4f3a-9e2d-7c5b1a0f3e6d';
const SCOPE = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const tokens = { access_token: 'access-1', refresh_token: 'refresh-1', id_token: 'id-1', token_type: 'Bearer', expires_in: 3600, scope: SCOPE };
const rotated = { access_token: 'access-2', refresh_token: 'refresh-2', token_type: 'bearer', expires_in: 3600 };
const models = { models: [{ slug: 'gpt-hidden', display_name: 'Hidden', visibility: 'hide' }, { slug: 'gpt-6.1-sol', display_name: 'GPT-6.1 Sol', visibility: 'list' }, { slug: 'gpt-6.1-mini', display_name: 'GPT-6.1 Mini', visibility: 'list' }] };
const listed = [{ slug: 'gpt-6.1-sol', name: 'GPT-6.1 Sol' }, { slug: 'gpt-6.1-mini', name: 'GPT-6.1 Mini' }];
type Reply = () => Response | Promise<Response>;
type Row = Record<string, string | number | null>;

let cookie: string;
beforeEach(async () => { cookie = await login('parent'); });
afterEach(() => { vi.restoreAllMocks(); });

function upstream(replies: Record<string, Reply>) {
	return vi.spyOn(globalThis, 'fetch').mockImplementation(async target => {
		const reply = replies[String(target)];
		if (!reply) throw new Error(`Unexpected request to ${target}.`);
		return reply();
	});
}
const form = (init?: RequestInit) => Object.fromEntries(new URLSearchParams(String(init?.body)));
const account = () => env.DB.prepare('SELECT * FROM tutor_account WHERE id=1').first<Row>();
const register = (clientId: string, model: string | null = null) => env.DB.prepare("INSERT INTO tutor_account (id,host_id,client_id,model,updated_at) VALUES (1,?,?,?,'now')").bind(HOST, clientId, model).run();
async function start() {
	const response = await request('/tutor/account/start', 'POST', undefined, cookie);
	expect(response.status).toBe(200);
	return new URL((await response.json() as { url: string }).url);
}
async function connect() {
	const state = (await start()).searchParams.get('state');
	upstream({ [TOKEN]: () => Response.json(tokens), [MODELS]: () => Response.json(models) });
	expect((await request('/tutor/account/finish', 'POST', { address: `${CALLBACK}?code=c&state=${state}&client_id=oaiapp_x` }, cookie)).status).toBe(200);
	vi.restoreAllMocks();
}
// Stored value: base64 of a 12-byte IV followed by the AES-GCM ciphertext.
async function open(value: unknown) {
	const raw = Uint8Array.from(atob(String(value)), c => c.charCodeAt(0)), secret = await crypto.subtle.importKey('raw', Uint8Array.from(atob(String(env.TUTOR_TOKEN_KEY)), c => c.charCodeAt(0)), 'AES-GCM', false, ['decrypt']);
	return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.subarray(0, 12) }, secret, raw.subarray(12)));
}
async function challenge(verifier: string) {
	return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

it.each([
	{ name: 'first start', clientId: null, registration: { client_id: 'dynamic_agent_client', agent_name_hint: 'redlamp notebook' } },
	{ name: 'start after registration', clientId: 'oaiapp_x', registration: { client_id: 'oaiapp_x' } },
])('$name', async ({ clientId, registration }) => {
	if (clientId) await register(clientId);
	const first = await start(), url = await start(), row = (await account())!;
	expect(url.origin + url.pathname).toBe(AUTHORIZE);
	expect(Object.fromEntries(url.searchParams)).toEqual({
		...registration, ext_agent_host_id: row.host_id, response_type: 'code', redirect_uri: CALLBACK, scope: SCOPE, resource: RESOURCE, state: row.pending_state,
		nonce: expect.stringMatching(/^[\w-]{43}$/), code_challenge_method: 'S256', code_challenge: await challenge(String(row.pending_verifier)),
	});
	expect(row.host_id).toMatch(/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	expect(first.searchParams.get('ext_agent_host_id')).toBe(row.host_id);
	expect(row.pending_verifier).toMatch(/^[\w-]{43}$/);
	expect(await (await request('/tutor/account', 'GET', undefined, cookie)).json()).toEqual({ connected: false, connectedAt: null, model: null, models: [], pending: true });
});

it.each([
	{ name: 'missing key', key: undefined },
	{ name: 'short key', key: btoa('k'.repeat(16)) },
])('$name', async ({ key }) => {
	const response = await worker.fetch(new Request('https://redlamp.me/leetcode/api/tutor/account/start', { method: 'POST', headers: { Cookie: cookie, Origin: 'https://redlamp.me' } }), { ...env, TUTOR_TOKEN_KEY: key });
	expect(response.status).toBe(503);
	expect(await response.json()).toMatchObject({ error: { code: 'setup_required' } });
});

const valid = `${CALLBACK}?code=c&state=S&client_id=oaiapp_x`;
it.each([
	{ name: 'localhost host', address: 'http://localhost:47319/auth/callback?code=c&state=S&client_id=oaiapp_x', status: 400, code: 'invalid_address', calls: [], client: null },
	{ name: 'other port', address: 'http://127.0.0.1:1455/auth/callback?code=c&state=S&client_id=oaiapp_x', status: 400, code: 'invalid_address', calls: [], client: null },
	{ name: 'other path', address: 'http://127.0.0.1:47319/callback?code=c&state=S&client_id=oaiapp_x', status: 400, code: 'invalid_address', calls: [], client: null },
	{ name: 'not a URL', address: 'code=c', status: 400, code: 'invalid_address', calls: [], client: null },
	{ name: 'no pending sign-in', setup: 'none', address: valid, status: 400, code: 'sign_in_expired', calls: [], client: null },
	{ name: 'expired sign-in', setup: 'expired', address: valid, status: 400, code: 'sign_in_expired', calls: [], client: null },
	{ name: 'second start replaces the first', setup: 'restart', address: valid, status: 400, code: 'sign_in_expired', calls: [], client: null },
	{ name: 'other state', address: `${CALLBACK}?code=c&state=T&client_id=oaiapp_x`, status: 400, code: 'sign_in_expired', calls: [], client: null },
	{ name: 'two state values', address: `${CALLBACK}?code=c&state=S&state=S&client_id=oaiapp_x`, status: 400, code: 'sign_in_expired', calls: [], client: null },
	{ name: 'access denied', address: `${CALLBACK}?error=access_denied&state=S`, status: 400, code: 'not_approved', calls: [], client: null, pending: false },
	{ name: 'first registration without client_id', address: `${CALLBACK}?code=c&state=S`, status: 400, code: 'sign_in_failed', calls: [], client: null },
	{ name: 'client_id is dynamic_agent_client', address: `${CALLBACK}?code=c&state=S&client_id=dynamic_agent_client`, status: 400, code: 'sign_in_failed', calls: [], client: null },
	{ name: 'other client_id on reauthorization', stored: 'oaiapp_a', address: `${CALLBACK}?code=c&state=S&client_id=oaiapp_b`, status: 400, code: 'sign_in_failed', calls: [], client: 'oaiapp_a' },
	{ name: 'exchange invalid_grant keeps the issued ID', token: () => Response.json({ error: 'invalid_grant' }, { status: 400 }), address: valid, status: 400, code: 'sign_in_failed', calls: [TOKEN], client: 'oaiapp_x' },
	{ name: 'exchange reply without refresh_token', token: () => Response.json({ ...tokens, refresh_token: undefined }), address: valid, status: 400, code: 'sign_in_failed', calls: [TOKEN], client: 'oaiapp_x' },
	{ name: 'exchange server error', token: () => new Response('Busy', { status: 503 }), address: valid, status: 503, code: 'ai_unavailable', calls: [TOKEN], client: 'oaiapp_x' },
	{ name: 'scope without plan use', token: () => Response.json({ ...tokens, scope: 'openid profile email offline_access' }), address: valid, status: 403, code: 'ai_not_eligible', calls: [TOKEN], client: 'oaiapp_x' },
	{ name: 'no listed model', list: () => Response.json({ models: [{ slug: 'm', visibility: 'hide' }] }), address: valid, status: 403, code: 'ai_not_eligible', calls: [TOKEN, MODELS], client: 'oaiapp_x' },
	{ name: 'first registration', address: valid, status: 200, calls: [TOKEN, MODELS], client: 'oaiapp_x', model: 'gpt-6.1-sol' },
	{ name: 'reauthorization without client_id', stored: 'oaiapp_x', address: `${CALLBACK}?code=c&state=S`, status: 200, calls: [TOKEN, MODELS], client: 'oaiapp_x', model: 'gpt-6.1-sol' },
	{ name: 'a reconnect keeps a model that is still listed', stored: 'oaiapp_x', storedModel: 'gpt-6.1-mini', address: valid, status: 200, calls: [TOKEN, MODELS], client: 'oaiapp_x', model: 'gpt-6.1-mini' },
	{ name: 'a reconnect replaces a model that is not listed', stored: 'oaiapp_x', storedModel: 'gpt-retired', address: valid, status: 200, calls: [TOKEN, MODELS], client: 'oaiapp_x', model: 'gpt-6.1-sol' },
] as { name: string; setup?: string; stored?: string; storedModel?: string; token?: Reply; list?: Reply; address: string; status: number; code?: string; calls: string[]; client: string | null; pending?: boolean; model?: string }[])('$name', async ({ setup, stored, storedModel, token, list, address, status, code, calls, client, pending, model }) => {
	if (stored) await register(stored, storedModel);
	const state = setup === 'none' ? 'S' : (await start()).searchParams.get('state')!;
	if (setup === 'expired') await env.DB.prepare('UPDATE tutor_account SET pending_expires_at=?').bind(Date.now() - 1).run();
	if (setup === 'restart') await start();
	const verifier = (await account())?.pending_verifier, now = Date.now();
	const spy = upstream({ [TOKEN]: token ?? (() => Response.json(tokens)), [MODELS]: list ?? (() => Response.json(models)) });
	const response = await request('/tutor/account/finish', 'POST', { address: address.replaceAll('state=S', `state=${state}`) }, cookie);
	expect(response.status).toBe(status);
	expect(spy.mock.calls.map(([target]) => String(target))).toEqual(calls);
	const row = await account();
	expect(row?.client_id ?? null).toBe(client);
	if (status === 200) {
		expect(await response.json()).toEqual({ connected: true, connectedAt: expect.any(String), model, models: listed, pending: false });
		expect(form(spy.mock.calls[0][1])).toEqual({ grant_type: 'authorization_code', client_id: client, code: 'c', code_verifier: verifier, redirect_uri: CALLBACK, resource: RESOURCE });
		expect(spy.mock.calls[1][1]?.headers).toEqual({ Authorization: 'Bearer access-1' });
		expect([row!.access_token, row!.refresh_token].join()).not.toMatch(/access-1|refresh-1/);
		expect(Number(row!.expires_at)).toBeGreaterThanOrEqual(now + 3_600_000);
		expect(Number(row!.expires_at)).toBeLessThanOrEqual(Date.now() + 3_600_000);
	} else {
		expect(await response.json()).toMatchObject({ error: { code } });
		expect([row?.access_token ?? null, row?.refresh_token ?? null]).toEqual([null, null]);
	}
	if (pending === false) expect(await (await request('/tutor/account', 'GET', undefined, cookie)).json()).toMatchObject({ pending: false });
});

it.each([
	{ name: 'fresh token', expiresIn: 1_800_000, refreshAfter: null, calls: 0, result: 'access-1', after: 'kept' },
	{ name: 'near expiry', expiresIn: 240_000, refreshAfter: -60_000, reply: () => Response.json(rotated), calls: 1, result: 'access-2', after: 'rotated' },
	{ name: 'near expiry, refresh not allowed yet', expiresIn: 240_000, refreshAfter: 60_000, calls: 0, result: 'access-1', after: 'kept' },
	{ name: 'expired, refresh not allowed yet', expiresIn: -1000, refreshAfter: 60_000, calls: 0, result: 'ai_unavailable', after: 'kept' },
	{ name: 'refresh form', expiresIn: -1000, refreshAfter: null, reply: () => Response.json(rotated), calls: 1, result: 'access-2', after: 'rotated' },
	{ name: 'earliest_refresh_at as ISO string', expiresIn: -1000, refreshAfter: null, reply: () => Response.json({ ...rotated, earliest_refresh_at: '2026-10-09T12:30:00Z' }), calls: 1, result: 'access-2', after: 'rotated', stored: 1791549000000 },
	{ name: 'earliest_refresh_at as Unix seconds', expiresIn: -1000, refreshAfter: null, reply: () => Response.json({ ...rotated, earliest_refresh_at: 1791549000 }), calls: 1, result: 'access-2', after: 'rotated', stored: 1791549000000 },
	{ name: 'reused refresh token', expiresIn: -1000, refreshAfter: null, reply: () => Response.json({ error: 'refresh_token_reused' }, { status: 400 }), calls: 1, result: 'ai_disconnected', after: 'cleared' },
	{ name: 'invalid grant', expiresIn: -1000, refreshAfter: null, reply: () => Response.json({ error: 'invalid_grant' }, { status: 400 }), calls: 1, result: 'ai_disconnected', after: 'cleared' },
	{ name: 'server error', expiresIn: -1000, refreshAfter: null, reply: () => new Response('Busy', { status: 503 }), calls: 1, result: 'ai_unavailable', after: 'kept' },
	{ name: 'network error', expiresIn: -1000, refreshAfter: null, reply: () => { throw new TypeError('Network connection lost.'); }, calls: 1, result: 'ai_unavailable', after: 'kept' },
	{ name: 'refresh reply that is not bearer', expiresIn: -1000, refreshAfter: null, reply: () => Response.json({ ...rotated, token_type: 'mac' }), calls: 1, result: 'ai_unavailable', after: 'kept' },
	{ name: 'forced refresh after 401', expiresIn: 1_800_000, refreshAfter: null, stale: true, reply: () => Response.json(rotated), calls: 1, result: 'access-2', after: 'rotated' },
	{ name: 'key changed', expiresIn: 1_800_000, refreshAfter: null, key: btoa('n'.repeat(32)), calls: 0, result: 'ai_disconnected', after: 'kept' },
	{ name: 'not connected', expiresIn: 1_800_000, refreshAfter: null, disconnected: true, calls: 0, result: 'ai_disconnected', after: 'kept' },
] as { name: string; expiresIn: number; refreshAfter: number | null; stale?: boolean; key?: string; disconnected?: boolean; reply?: Reply; calls: number; result: string; after: string; stored?: number }[])('$name', async ({ expiresIn, refreshAfter, stale, key, disconnected, reply, calls, result, after, stored }) => {
	await connect();
	const now = Date.now();
	await env.DB.prepare('UPDATE tutor_account SET expires_at=?,refresh_after=?').bind(now + expiresIn, refreshAfter === null ? null : now + refreshAfter).run();
	if (disconnected) await env.DB.prepare('UPDATE tutor_account SET access_token=NULL,refresh_token=NULL,expires_at=NULL').run();
	const before = (await account())!;
	const spy = upstream(reply ? { [TOKEN]: reply } : {});
	expect(await accessToken(key ? { ...env, TUTOR_TOKEN_KEY: key } : env, stale ? Number(before.version) : undefined).then(token => token.access, (error: HttpError) => error.code)).toBe(result);
	expect(spy.mock.calls.map(([target, init]) => [String(target), form(init)])).toEqual(calls ? [[TOKEN, { grant_type: 'refresh_token', client_id: 'oaiapp_x', refresh_token: 'refresh-1', resource: RESOURCE }]] : []);
	const row = (await account())!;
	if (after === 'kept') expect(row).toEqual(before);
	if (after === 'cleared') expect(row).toEqual({ ...before, access_token: null, refresh_token: null, expires_at: null, refresh_after: null, refreshing_until: null, version: Number(before.version) + 1, updated_at: expect.any(String) });
	if (after === 'rotated') {
		expect(row).toMatchObject({ version: Number(before.version) + 1, refreshing_until: null, refresh_after: stored ?? null });
		expect([await open(row.access_token), await open(row.refresh_token)]).toEqual(['access-2', 'refresh-2']);
		expect(Number(row.expires_at)).toBeGreaterThanOrEqual(now + 3_600_000);
	}
});

it('refreshes once for two parallel callers', async () => {
	await connect();
	await env.DB.prepare('UPDATE tutor_account SET expires_at=?').bind(Date.now() - 1000).run();
	const before = (await account())!;
	const spy = upstream({ [TOKEN]: async () => { await scheduler.wait(100); return Response.json(rotated); } });
	expect((await Promise.all([accessToken(env), accessToken(env)])).map(token => token.access)).toEqual(['access-2', 'access-2']);
	expect(spy).toHaveBeenCalledTimes(1);
	expect((await account())!.version).toBe(Number(before.version) + 1);
});

it.each([
	{ name: 'listed model', disconnected: false, model: 'gpt-6.1-mini', status: 200, code: null, stored: 'gpt-6.1-mini' },
	{ name: 'model not in the list', disconnected: false, model: 'gpt-hidden', status: 400, code: 'invalid_input', stored: 'gpt-6.1-sol' },
	{ name: 'model change when not connected', disconnected: true, model: 'gpt-6.1-mini', status: 409, code: 'ai_disconnected', stored: 'gpt-6.1-sol' },
])('$name', async ({ disconnected, model, status, code, stored }) => {
	await connect();
	if (disconnected) await env.DB.prepare('UPDATE tutor_account SET access_token=NULL,refresh_token=NULL,expires_at=NULL').run();
	const response = await request('/tutor/account', 'PATCH', { model }, cookie);
	expect(response.status).toBe(status);
	expect(await response.json()).toMatchObject(code ? { error: { code } } : { connected: true, model, models: listed });
	expect((await account())!.model).toBe(stored);
});

it.each([
	{ name: 'revoke confirmed', connected: true, reply: () => new Response(null, { status: 200 }), revoked: true },
	{ name: 'revoke server error', connected: true, reply: () => new Response('Busy', { status: 503 }), revoked: false },
	{ name: 'revoke network error', connected: true, reply: () => { throw new TypeError('Network connection lost.'); }, revoked: false },
	{ name: 'disconnect when not connected', connected: false, reply: () => new Response(null, { status: 200 }), revoked: true },
])('$name', async ({ connected, reply, revoked }) => {
	if (connected) await connect(); else await start();
	const before = (await account())!;
	const spy = upstream({ [REVOKE]: reply });
	const response = await request('/tutor/account', 'DELETE', undefined, cookie);
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ revoked });
	expect(spy.mock.calls.map(([target, init]) => [String(target), form(init)])).toEqual(connected ? [[REVOKE, { token: 'refresh-1', token_type_hint: 'refresh_token', client_id: 'oaiapp_x' }]] : []);
	expect(await account()).toMatchObject({ access_token: null, refresh_token: null, expires_at: null, pending_state: null, pending_verifier: null, host_id: before.host_id, client_id: before.client_id });
});

it.each([
	{ name: 'student reads account', method: 'GET', path: '/tutor/account' },
	{ name: 'student starts a sign-in', method: 'POST', path: '/tutor/account/start' },
	{ name: 'student changes the model', method: 'PATCH', path: '/tutor/account', body: { model: 'gpt-6.1-sol' } },
	{ name: 'student disconnects', method: 'DELETE', path: '/tutor/account' },
])('$name', async ({ method, path, body }) => {
	const response = await request(path, method, body, await login('student'));
	expect(response.status).toBe(403);
	expect(await response.json()).toMatchObject({ error: { code: 'forbidden' } });
});
